/**
 * HealthBridge Document Store — Cloudflare Worker
 *
 * R2-backed clinical document storage.
 *
 * Object key format: {facilityId}/{docType}/{documentId}
 *   docTypes: cbahi | discharge | audit | imaging | policy | prescription
 *
 * Endpoints:
 *   PUT  /api/documents/:facilityId/:docType/:documentId  — upload
 *   GET  /api/documents/:facilityId/:docType/:documentId  — download
 *   HEAD /api/documents/:facilityId/:docType/:documentId  — metadata
 *   DELETE /api/documents/:facilityId/:docType/:documentId — delete
 *   GET  /api/documents/:facilityId/:docType              — list by type
 */

import { corsHeaders, errorResponse, jsonResponse } from '../../shared/auth';

export interface Env {
  DOCUMENTS_R2: R2Bucket;
  MAX_UPLOAD_SIZE_MB: string;
  ALLOWED_TYPES: string;
  ENVIRONMENT: string;
}

const VALID_DOC_TYPES = new Set(['cbahi', 'discharge', 'audit', 'imaging', 'policy', 'prescription', 'lab']);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === '/api/health') {
      return jsonResponse({ status: 'ok', service: 'document-store' }, 200, origin);
    }

    // Parse path: /api/documents/:facilityId/:docType[/:documentId]
    const match = url.pathname.match(/^\/api\/documents\/([^/]+)\/([^/]+)(?:\/([^/]+))?$/);
    if (!match) return errorResponse('Invalid document path', 400, origin);

    const [, facilityId, docType, documentId] = match;

    // Validate doc type
    if (!VALID_DOC_TYPES.has(docType)) {
      return errorResponse(`Invalid docType. Must be one of: ${[...VALID_DOC_TYPES].join(', ')}`, 400, origin);
    }

    // Facility-scoped operations — the gateway injects X-Facility-Id
    const requestingFacility = request.headers.get('X-Facility-Id');
    if (requestingFacility && requestingFacility !== facilityId) {
      return errorResponse('Access denied: facility mismatch', 403, origin);
    }

    switch (request.method) {
      case 'PUT':
        if (!documentId) return errorResponse('documentId is required for upload', 400, origin);
        return handleUpload(request, env, facilityId, docType, documentId, origin);
      case 'GET':
        if (documentId) return handleDownload(env, facilityId, docType, documentId, origin);
        return handleList(env, facilityId, docType, url, origin);
      case 'HEAD':
        if (!documentId) return errorResponse('documentId is required', 400, origin);
        return handleHead(env, facilityId, docType, documentId, origin);
      case 'DELETE':
        if (!documentId) return errorResponse('documentId is required for delete', 400, origin);
        return handleDelete(env, facilityId, docType, documentId, origin);
      default:
        return errorResponse('Method not allowed', 405, origin);
    }
  },
};

async function handleUpload(
  request: Request,
  env: Env,
  facilityId: string,
  docType: string,
  documentId: string,
  origin: string | null
): Promise<Response> {
  const contentType = request.headers.get('Content-Type') ?? 'application/octet-stream';
  const allowedTypes = env.ALLOWED_TYPES.split(',');
  const maxSizeMB = parseInt(env.MAX_UPLOAD_SIZE_MB, 10) || 50;

  // Validate content type
  const baseType = contentType.split(';')[0].trim();
  if (!allowedTypes.includes(baseType)) {
    return errorResponse(`Content-Type not allowed: ${baseType}`, 415, origin);
  }

  if (!request.body) return errorResponse('Request body is required', 400, origin);

  // Enforce size limit by reading with a cap
  const key = `${facilityId}/${docType}/${documentId}`;
  const contentLength = parseInt(request.headers.get('Content-Length') ?? '0', 10);
  if (contentLength > maxSizeMB * 1024 * 1024) {
    return errorResponse(`File exceeds max size of ${maxSizeMB}MB`, 413, origin);
  }

  // Build custom metadata
  const customMetadata: Record<string, string> = {
    facilityId,
    docType,
    documentId,
    uploadedAt: new Date().toISOString(),
    uploadedBy: request.headers.get('X-Facility-Id') ?? 'unknown',
  };

  // Optional patient / context metadata from headers
  const patientId = request.headers.get('X-Patient-Id');
  if (patientId) customMetadata['patientId'] = patientId;

  const filename = request.headers.get('X-Filename');
  if (filename) customMetadata['filename'] = filename;

  try {
    const object = await env.DOCUMENTS_R2.put(key, request.body, {
      httpMetadata: { contentType },
      customMetadata,
    });

    return jsonResponse(
      {
        key,
        etag: object?.etag,
        size: object?.size,
        uploadedAt: customMetadata['uploadedAt'],
        docType,
        documentId,
        facilityId,
      },
      201,
      origin
    );
  } catch (err) {
    return errorResponse('Upload failed', 500, origin);
  }
}

async function handleDownload(
  env: Env,
  facilityId: string,
  docType: string,
  documentId: string,
  origin: string | null
): Promise<Response> {
  const key = `${facilityId}/${docType}/${documentId}`;
  const object = await env.DOCUMENTS_R2.get(key);

  if (!object) return errorResponse('Document not found', 404, origin);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.etag);
  headers.set('Last-Modified', object.uploaded.toUTCString());
  headers.set('Content-Length', String(object.size));
  Object.entries(corsHeaders(origin)).forEach(([k, v]) => headers.set(k, v));

  // Suggest filename if available
  const filename = object.customMetadata?.['filename'];
  if (filename) {
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
  }

  return new Response(object.body, { headers });
}

async function handleHead(
  env: Env,
  facilityId: string,
  docType: string,
  documentId: string,
  origin: string | null
): Promise<Response> {
  const key = `${facilityId}/${docType}/${documentId}`;
  const object = await env.DOCUMENTS_R2.head(key);

  if (!object) return errorResponse('Document not found', 404, origin);

  const headers = new Headers(corsHeaders(origin));
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.etag);
  headers.set('Content-Length', String(object.size));
  headers.set('Last-Modified', object.uploaded.toUTCString());
  if (object.customMetadata) {
    Object.entries(object.customMetadata).forEach(([k, v]) => headers.set(`X-Meta-${k}`, v));
  }

  return new Response(null, { status: 200, headers });
}

async function handleDelete(
  env: Env,
  facilityId: string,
  docType: string,
  documentId: string,
  origin: string | null
): Promise<Response> {
  const key = `${facilityId}/${docType}/${documentId}`;
  const existing = await env.DOCUMENTS_R2.head(key);
  if (!existing) return errorResponse('Document not found', 404, origin);

  await env.DOCUMENTS_R2.delete(key);
  return jsonResponse({ deleted: true, key }, 200, origin);
}

async function handleList(
  env: Env,
  facilityId: string,
  docType: string,
  url: URL,
  origin: string | null
): Promise<Response> {
  const prefix = `${facilityId}/${docType}/`;
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10), 1000);
  const cursor = url.searchParams.get('cursor') ?? undefined;

  const listed = await env.DOCUMENTS_R2.list({ prefix, limit, cursor });

  const documents = listed.objects.map((obj) => ({
    key: obj.key,
    documentId: obj.key.split('/').pop(),
    size: obj.size,
    etag: obj.etag,
    uploadedAt: obj.uploaded.toISOString(),
  }));

  return jsonResponse(
    {
      facilityId,
      docType,
      count: documents.length,
      truncated: listed.truncated,
      cursor: listed.truncated ? listed.cursor : null,
      documents,
    },
    200,
    origin
  );
}
