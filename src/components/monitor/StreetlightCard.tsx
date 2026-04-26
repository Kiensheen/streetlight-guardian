import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Streetlight, LightStatus, HealthStatus } from '@/types/streetlight';
import { Lightbulb, Zap, Activity, Power, MapPin, Battery, Eye, Move, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StreetlightCardProps {
  streetlight: Streetlight;
}

const statusConfig: Record<LightStatus, { label: string; className: string; icon: typeof Lightbulb }> = {
  on: { label: 'On', className: 'bg-success text-success-foreground', icon: Lightbulb },
  off: { label: 'Off', className: 'bg-destructive text-destructive-foreground', icon: Lightbulb },
  flickering: { label: 'Flickering', className: 'bg-warning text-warning-foreground', icon: Activity },
  dim: { label: 'Dim', className: 'bg-warning text-warning-foreground', icon: Lightbulb },
};

const healthConfig: Record<HealthStatus, { color: string; bgColor: string; ringColor: string }> = {
  healthy: { color: 'text-success', bgColor: 'bg-success/10', ringColor: 'ring-success/20' },
  warning: { color: 'text-warning', bgColor: 'bg-warning/10', ringColor: 'ring-warning/20' },
  fault: { color: 'text-destructive', bgColor: 'bg-destructive/10', ringColor: 'ring-destructive/20' },
};

const DASH = '--';
const hasValue = (n: number | undefined) => typeof n === 'number' && Number.isFinite(n);

const StreetlightCard: React.FC<StreetlightCardProps> = ({ streetlight }) => {
  const hasData = streetlight.hasData ?? false;
  const showLive = hasData;

  const effectiveHealth: HealthStatus = showLive ? streetlight.healthStatus : 'healthy';
  const status = statusConfig[streetlight.status];
  const health = healthConfig[effectiveHealth];
  const StatusIcon = status.icon;

  const batteryColor = !showLive
    ? 'text-muted-foreground'
    : streetlight.batterySOH >= 80 ? 'text-success'
    : streetlight.batterySOH >= 50 ? 'text-warning'
    : 'text-destructive';

  const fmt = (n: number, digits = 1) => showLive && hasValue(n) ? n.toFixed(digits) : DASH;

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-300 hover:shadow-lg",
      "border-border/50",
      hasData ? health.ringColor : "ring-border/30",
      "ring-2 ring-inset",
      !hasData && "opacity-90"
    )}>
      <div className={cn("absolute top-0 left-0 right-0 h-1", {
        'bg-success': hasData && effectiveHealth === 'healthy',
        'bg-warning': hasData && effectiveHealth === 'warning',
        'bg-destructive': hasData && effectiveHealth === 'fault',
        'bg-muted': !hasData,
      })} />

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-xl", hasData ? health.bgColor : "bg-muted")}>
              <StatusIcon className={cn("h-6 w-6", hasData ? health.color : "text-muted-foreground")} />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">{streetlight.name}</CardTitle>
              {streetlight.location && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <MapPin className="h-3 w-3" />
                  {streetlight.location}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!hasData && (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-center">
            <p className="text-xs font-medium text-muted-foreground">
              Waiting for first transmission
            </p>
          </div>
        )}

        {/* Primary metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Zap className="h-3.5 w-3.5" />
              <span className="text-xs font-medium uppercase tracking-wide">Batt V</span>
            </div>
            <p className="text-xl font-bold tabular-nums">
              {fmt(streetlight.voltage, 2)}
              <span className="text-sm font-normal text-muted-foreground ml-1">V</span>
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              <span className="text-xs font-medium uppercase tracking-wide">LED I</span>
            </div>
            <p className="text-xl font-bold tabular-nums">
              {fmt(streetlight.current, 1)}
              <span className="text-sm font-normal text-muted-foreground ml-1">mA</span>
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Power className="h-3.5 w-3.5" />
              <span className="text-xs font-medium uppercase tracking-wide">Power</span>
            </div>
            <p className="text-xl font-bold tabular-nums">
              {fmt(streetlight.power, 1)}
              <span className="text-sm font-normal text-muted-foreground ml-1">mW</span>
            </p>
          </div>
        </div>

        {/* Secondary metrics */}
        <div className="grid grid-cols-4 gap-2">
          <div className="space-y-1 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <Battery className="h-3 w-3" />
            </div>
            <p className={cn("text-sm font-bold tabular-nums", batteryColor)}>
              {showLive && hasValue(streetlight.batterySOH) ? `${streetlight.batterySOH.toFixed(0)}%` : DASH}
            </p>
            <p className="text-[10px] text-muted-foreground">SoH</p>
          </div>

          <div className="space-y-1 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <Eye className="h-3 w-3" />
            </div>
            <p className="text-sm font-bold tabular-nums">
              {fmt(streetlight.luminance, 0)}
            </p>
            <p className="text-[10px] text-muted-foreground">Lux</p>
          </div>

          <div className="space-y-1 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <Moon className="h-3 w-3" />
            </div>
            <p className="text-sm font-bold tabular-nums">
              {fmt(streetlight.ldr, 0)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {showLive && hasValue(streetlight.ldr) ? (streetlight.ldr > 1000 ? 'Night' : streetlight.ldr < 500 ? 'Day' : 'Dusk') : '—'}
            </p>
          </div>

          <div className="space-y-1 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <Move className="h-3 w-3" />
            </div>
            <p className={cn("text-sm font-bold", !showLive ? 'text-muted-foreground' : streetlight.motionDetected ? 'text-success' : 'text-muted-foreground')}>
              {showLive && streetlight.motionDetected !== undefined ? (streetlight.motionDetected ? 'Yes' : 'No') : DASH}
            </p>
            <p className="text-[10px] text-muted-foreground">Motion</p>
          </div>
        </div>

        {/* ESP32-derived statuses */}
        {showLive && (streetlight.ledStatus || streetlight.batteryStatus || streetlight.soh !== undefined) && (
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Battery SoH</p>
              <div className="flex items-center gap-2">
                <div className="relative h-8 w-8 shrink-0">
                  <svg viewBox="0 0 36 36" className="h-8 w-8 -rotate-90">
                    <circle cx="18" cy="18" r="15" fill="none" className="stroke-muted" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15" fill="none" strokeWidth="3" strokeLinecap="round"
                      className={cn(
                        (streetlight.soh ?? streetlight.batterySOH) >= 80 ? 'stroke-success'
                        : (streetlight.soh ?? streetlight.batterySOH) >= 50 ? 'stroke-warning'
                        : 'stroke-destructive'
                      )}
                      strokeDasharray={`${Math.max(0, Math.min(100, streetlight.soh ?? streetlight.batterySOH)) * 0.94} 94`}
                    />
                  </svg>
                </div>
                <span className="text-sm font-bold tabular-nums">
                  {(streetlight.soh ?? streetlight.batterySOH).toFixed(0)}%
                </span>
              </div>
              {streetlight.batteryStatus && (
                <span className="inline-flex rounded-md border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                  {streetlight.batteryStatus}
                </span>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">LED Status</p>
              <span className="inline-flex rounded-md border border-border px-2 py-0.5 text-left text-[10px] text-muted-foreground">
                {streetlight.ledStatus ?? DASH}
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Active Faults</p>
              <p className={cn(
                "text-lg font-bold tabular-nums",
                (Number(streetlight.ledStatus === 'DEGRADED') + Number(streetlight.batteryStatus === 'DEGRADED') + Number((streetlight.soh ?? 100) < 50)) > 0
                  ? "text-destructive" : "text-success"
              )}>
                {Number(streetlight.ledStatus === 'DEGRADED') + Number(streetlight.batteryStatus === 'DEGRADED') + Number((streetlight.soh ?? 100) < 50)}
              </p>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            {hasData
              ? `Last updated: ${streetlight.lastUpdated > 0 ? new Date(streetlight.lastUpdated).toLocaleString() : '--'}`
              : 'No data received yet'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default StreetlightCard;
