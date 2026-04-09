import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Activity, Users, Clock, TrendingUp } from 'lucide-react';

/**
 * 🏥 BrainSAIT ED Flow Dashboard
 * Real-time Emergency Department metrics visualization
 * 
 * NEURAL: Glass morphism + mesh gradient + BrainSAIT color palette
 * BILINGUAL: Arabic/English toggle
 * MEDICAL: CBAHI/JCI KPI tracking
 */

interface EDMetrics {
  hospital_code: string;
  timestamp: string;
  total_patients: number;
  capacity: number;
  occupancy_percentage: number;
  waiting_count: number;
  triaged_count: number;
  bedded_count: number;
  exit_block_count: number;
  avg_wait_to_triage_minutes: number;
  avg_bed_assignment_wait_minutes: number;
  critical_count: number;
  fast_track_count: number;
  alerts: string[];
  alert_color?: string;
  recommendation: string;
}

interface EDDashboardProps {
  apiUrl: string;
  language?: 'en' | 'ar';
  userRole?: 'nurse' | 'physician' | 'admin';
}

const EDDashboard: React.FC<EDDashboardProps> = ({
  apiUrl,
  language = 'en',
  userRole = 'nurse'
}) => {
  const [metrics, setMetrics] = useState<EDMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRtl] = useState(language === 'ar');

  // BILINGUAL: Translation dictionary
  const translations = {
    en: {
      title: 'Emergency Department Flow Management',
      occupancy: 'Occupancy',
      waiting: 'Waiting',
      triaged: 'Triaged',
      bedded: 'Bedded',
      avgWait: 'Avg Wait to Triage',
      recommendation: 'Operational Recommendation',
      criticalPatients: 'Critical Patients',
      fastTrack: 'Fast Track',
      exitBlocks: 'Exit Blocks',
      capacity: 'Capacity',
      minutes: 'min',
      refresh: 'Auto-refresh: 30s'
    },
    ar: {
      title: 'إدارة تدفق قسم الطوارئ',
      occupancy: 'معدل الاشغال',
      waiting: 'في الانتظار',
      triaged: 'تم الفحص',
      bedded: 'مخصص سرير',
      avgWait: 'متوسط الانتظار للفحص',
      recommendation: 'توصية التشغيل',
      criticalPatients: 'مرضى حرجة',
      fastTrack: 'مسار سريع',
      exitBlocks: 'عدم القدرة على الخروج',
      capacity: 'السعة',
      minutes: 'دقيقة',
      refresh: 'تحديث تلقائي: 30 ثانية'
    }
  };

  const t = translations[language];

  // Fetch metrics from Cloudflare Worker
  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/ed/metrics`, {
        headers: {
          'X-User-Role': userRole,
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch metrics');

      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, userRole]);

  // NEURAL: Auto-refresh every 30 seconds
  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  if (loading && !metrics) {
    return (
      <div className={`flex items-center justify-center h-screen ${isRtl ? 'rtl' : 'ltr'}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0ea5e9]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-screen ${isRtl ? 'rtl' : 'ltr'}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
          <AlertCircle className="text-red-600 mb-2" />
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  // NEURAL: Color coding based on occupancy
  const getOccupancyColor = (occupancy: number): string => {
    if (occupancy > 95) return '#ea580c';     // Deep Orange - Critical
    if (occupancy > 85) return '#d4a574';     // Gold - Warning
    if (occupancy > 70) return '#0ea5e9';     // Teal - Caution
    return '#2b6cb8';                         // Medical Blue - Normal
  };

  const occupancyColor = getOccupancyColor(metrics.occupancy_percentage);

  return (
    <div
      className={`min-h-screen ${isRtl ? 'rtl' : 'ltr'} bg-gradient-to-br from-[#050810] via-[#0f1419] to-[#1a1f2e] p-6 font-inter`}
      style={{ direction: isRtl ? 'rtl' : 'ltr' }}
    >
      {/* Animated background mesh gradient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute w-full h-full opacity-30"
          style={{
            background: `radial-gradient(circle at ${Math.random() * 100}% ${Math.random() * 100}%, rgba(14, 165, 233, 0.3) 0%, transparent 50%)`
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            {t.title}
          </h1>
          <div className="flex items-center justify-between">
            <p className="text-[#64748b] text-sm">
              {metrics.hospital_code} • {new Date(metrics.timestamp).toLocaleTimeString()}
            </p>
            <div className="flex items-center gap-2 text-[#0ea5e9] text-sm">
              <Activity className="w-4 h-4 animate-pulse" />
              {t.refresh}
            </div>
          </div>
        </div>

        {/* Main metrics grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Occupancy - Large card */}
          <div
            className="md:col-span-2 rounded-2xl p-6 backdrop-blur-xl border border-white/10"
            style={{
              background: `rgba(255, 255, 255, 0.05)`,
              boxShadow: `0 8px 32px rgba(${occupancyColor === '#ea580c' ? '234, 88, 12' : occupancyColor === '#d4a574' ? '212, 165, 116' : '14, 165, 233'}, 0.1)`
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[#64748b] text-sm font-semibold uppercase tracking-wider">
                {t.occupancy}
              </h2>
              <Users className="w-5 h-5 text-[#0ea5e9]" />
            </div>

            {/* Circular progress */}
            <div className="flex items-center gap-6">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="4"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    fill="none"
                    stroke={occupancyColor}
                    strokeWidth="4"
                    strokeDasharray={`${(metrics.occupancy_percentage / 100) * 251.2} 251.2`}
                    style={{ transition: 'stroke-dasharray 0.5s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">
                    {metrics.occupancy_percentage.toFixed(0)}%
                  </span>
                </div>
              </div>

              <div className="flex-1">
                <p className="text-white font-bold text-2xl">
                  {metrics.total_patients} / {metrics.capacity}
                </p>
                <p className="text-[#64748b] text-sm">{t.capacity}</p>
                <div className="mt-3 text-xs">
                  <p className="text-[#0ea5e9]">
                    {metrics.waiting_count} {t.waiting}
                  </p>
                  <p className="text-[#2b6cb8]">
                    {metrics.bedded_count} {t.bedded}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div
            className="rounded-2xl p-4 backdrop-blur-xl border border-white/10"
            style={{ background: 'rgba(255, 255, 255, 0.05)' }}
          >
            <h3 className="text-[#64748b] text-xs font-semibold mb-3 uppercase tracking-wider">
              {t.avgWait}
            </h3>
            <p className="text-3xl font-bold text-[#0ea5e9] mb-1">
              {metrics.avg_wait_to_triage_minutes.toFixed(0)}
            </p>
            <p className="text-[#64748b] text-xs">{t.minutes}</p>
            <div
              className="mt-3 h-1 rounded-full"
              style={{
                background: 'rgba(255,255,255,0.1)',
                overflow: 'hidden'
              }}
            >
              <div
                className="h-full bg-gradient-to-r from-[#0ea5e9] to-[#2b6cb8]"
                style={{ width: `${Math.min((metrics.avg_wait_to_triage_minutes / 120) * 100, 100)}%` }}
              />
            </div>
          </div>

          <div
            className="rounded-2xl p-4 backdrop-blur-xl border border-white/10"
            style={{ background: 'rgba(255, 255, 255, 0.05)' }}
          >
            <h3 className="text-[#64748b] text-xs font-semibold mb-3 uppercase tracking-wider">
              {t.criticalPatients}
            </h3>
            <p className="text-3xl font-bold text-[#ea580c]">
              {metrics.critical_count}
            </p>
            <p className="text-[#64748b] text-xs mt-3">
              {((metrics.critical_count / metrics.total_patients) * 100).toFixed(1)}% of total
            </p>
          </div>
        </div>

        {/* Status breakdown */}
        <div
          className="rounded-2xl p-6 backdrop-blur-xl border border-white/10 mb-6"
          style={{ background: 'rgba(255, 255, 255, 0.05)' }}
        >
          <h2 className="text-white font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#0ea5e9]" />
            Patient Status Distribution
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t.waiting, value: metrics.waiting_count, color: '#64748b' },
              { label: t.triaged, value: metrics.triaged_count, color: '#2b6cb8' },
              { label: t.bedded, value: metrics.bedded_count, color: '#0ea5e9' },
              { label: 'Exit Blocks', value: metrics.exit_block_count, color: '#ea580c' }
            ].map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-2xl font-bold text-white">{item.value}</p>
                <p className="text-[#64748b] text-xs mt-1">{item.label}</p>
                <div
                  className="mt-2 h-1 rounded-full mx-auto"
                  style={{
                    background: item.color,
                    width: `${(item.value / metrics.total_patients) * 100 + 20}px`,
                    opacity: 0.6
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Alerts & Recommendations */}
        {metrics.alerts.length > 0 && (
          <div
            className="rounded-2xl p-6 backdrop-blur-xl border border-white/10 mb-6"
            style={{
              background: `rgba(255, 255, 255, 0.05)`,
              borderColor: `${occupancyColor}40`
            }}
          >
            <h2 className="text-white font-bold mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" style={{ color: occupancyColor }} />
              Active Alerts
            </h2>
            <ul className="space-y-2">
              {metrics.alerts.map((alert, idx) => (
                <li
                  key={idx}
                  className="text-sm px-3 py-2 rounded-lg"
                  style={{
                    background: `${occupancyColor}20`,
                    color: occupancyColor,
                    borderLeft: `2px solid ${occupancyColor}`
                  }}
                >
                  {alert}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendation */}
        <div
          className="rounded-2xl p-6 backdrop-blur-xl border border-white/10"
          style={{
            background: 'rgba(43, 108, 184, 0.1)',
            borderColor: '#2b6cb840'
          }}
        >
          <h2 className="text-white font-bold mb-2">{t.recommendation}</h2>
          <p className="text-[#0ea5e9]">{metrics.recommendation}</p>
        </div>
      </div>
    </div>
  );
};

export default EDDashboard;
