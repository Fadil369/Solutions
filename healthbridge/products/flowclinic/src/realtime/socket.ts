import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

let io: SocketServer;

export function initSocket(server: HttpServer): SocketServer {
  io = new SocketServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    // In development, allow unauthenticated connections for kiosk/dashboard
    if (config.NODE_ENV === 'development') {
      (socket as any).user = { role: 'dev' };
      return next();
    }

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token as string, config.JWT_SECRET);
      (socket as any).user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = (socket as any).user?.sub || 'anonymous';
    logger.info('Socket connected', { socketId: socket.id, userId });

    // Join department room
    socket.on('join:department', (department: string) => {
      socket.join(`dept:${department}`);
      logger.debug('Socket joined department room', { socketId: socket.id, department });
    });

    // Leave department room
    socket.on('leave:department', (department: string) => {
      socket.leave(`dept:${department}`);
    });

    // Join dashboard room
    socket.on('join:dashboard', () => {
      socket.join('dashboard');
      logger.debug('Socket joined dashboard room', { socketId: socket.id });
    });

    socket.on('disconnect', () => {
      logger.debug('Socket disconnected', { socketId: socket.id });
    });
  });

  logger.info('Socket.IO initialized');
  return io;
}

export function getIO(): SocketServer {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initSocket() first.');
  }
  return io;
}

// Event emission helpers
export function emitQueueUpdated(department: string, queue: any[]): void {
  if (!io) return;
  io.to(`dept:${department}`).emit('queue:updated', { department, queue });
  io.to('dashboard').emit('queue:updated', { department, queue });
}

export function emitPatientCalled(entry: any, department: string, room?: string): void {
  if (!io) return;
  io.to(`dept:${department}`).emit('patient:called', { entry, department, room });
  io.to('dashboard').emit('patient:called', { entry, department, room });
}

export function emitPatientCompleted(entry: any, department: string): void {
  if (!io) return;
  io.to(`dept:${department}`).emit('patient:completed', { entry, department });
  io.to('dashboard').emit('patient:completed', { entry, department });
}

export function emitDoctorStatus(doctorId: string, status: string, department: string): void {
  if (!io) return;
  io.to(`dept:${department}`).emit('doctor:status', { doctorId, status, department });
  io.to('dashboard').emit('doctor:status', { doctorId, status, department });
}
