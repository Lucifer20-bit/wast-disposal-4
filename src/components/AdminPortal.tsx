import React, { useState, useEffect, useRef } from 'react';
import { 
  Truck, Navigation, CheckCircle2, Calendar, Users, AlertTriangle, 
  ArrowUpRight, ShieldAlert, DollarSign, Compass, Layers, RefreshCw, 
  BarChart3, Star, UserPlus, ShieldCheck, MapPin, Plus, Check, Map, Coins,
  Clock, History, Eye
} from 'lucide-react';
import { Bin, PickupRequest, Driver, PaymentTransaction, Customer } from '../types';

interface AdminPortalProps {
  bins: Bin[];
  pickups: PickupRequest[];
  drivers: Driver[];
  payments: PaymentTransaction[];
  customers: Customer[];
  onRegisterDriver: (
    name: string,
    vehicleNumber: string,
    vehicleType: string,
    vehicleCapacityKg: number,
    currentLat: number,
    currentLng: number
  ) => Promise<boolean>;
  onAssignDriver: (pickupId: string, driverId: string) => void;
  onDispatchDriver: (pickupId: string) => void;
  onRefresh: () => void;
}

export default function AdminPortal({
  bins,
  pickups,
  drivers = [],
  payments,
  customers = [],
  onRegisterDriver,
  onAssignDriver,
  onDispatchDriver,
  onRefresh
}: AdminPortalProps) {
  const [selectedMapItem, setSelectedMapItem] = useState<{ type: 'bin' | 'driver' | 'customer', data: any } | null>(null);
  const [mapLayer, setMapLayer] = useState<'all' | 'full' | 'trucks'>('all');
  const [mapMode, setMapMode] = useState<'standard' | 'heatmap' | 'routes'>('standard');
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  // Timeline state & live tracking
  interface TimelineEvent {
    id: string;
    timestamp: string;
    driverId: string;
    driverName: string;
    vehicleNumber: string;
    pickupId?: string;
    customerName?: string;
    address?: string;
    eventType: 'assigned' | 'dispatched' | 'completed' | 'cancelled';
    durationText?: string;
  }

  const [timelineFilter, setTimelineFilter] = useState<'all' | 'assigned' | 'dispatched' | 'completed'>('all');
  const [timeline, setTimeline] = useState<TimelineEvent[]>([
    {
      id: 'h-1',
      timestamp: new Date(Date.now() - 3600000 * 4.2).toISOString(),
      driverId: 'driver-2',
      driverName: 'Dave Miller',
      vehicleNumber: 'TRUCK-405',
      customerName: 'Marcus Vance',
      address: 'Pike Place Hub',
      eventType: 'completed',
      durationText: 'Trip completed in 18 mins (Shift active: 3h 10m)'
    },
    {
      id: 'h-2',
      timestamp: new Date(Date.now() - 3600000 * 3.1).toISOString(),
      driverId: 'driver-1',
      driverName: 'Marcus Vance',
      vehicleNumber: 'TRUCK-901',
      customerName: 'Aisha Rahman',
      address: '1224 Pine St',
      eventType: 'assigned',
      durationText: 'Pending dispatch'
    },
    {
      id: 'h-3',
      timestamp: new Date(Date.now() - 3600000 * 2.9).toISOString(),
      driverId: 'driver-1',
      driverName: 'Marcus Vance',
      vehicleNumber: 'TRUCK-901',
      customerName: 'Aisha Rahman',
      address: '1224 Pine St',
      eventType: 'dispatched',
      durationText: 'En route'
    },
    {
      id: 'h-4',
      timestamp: new Date(Date.now() - 3600000 * 2.5).toISOString(),
      driverId: 'driver-1',
      driverName: 'Marcus Vance',
      vehicleNumber: 'TRUCK-901',
      customerName: 'Aisha Rahman',
      address: '1224 Pine St',
      eventType: 'completed',
      durationText: 'Trip completed in 22 mins (Shift active: 1h 45m)'
    },
    {
      id: 'h-5',
      timestamp: new Date(Date.now() - 3600000 * 1.2).toISOString(),
      driverId: 'driver-2',
      driverName: 'Dave Miller',
      vehicleNumber: 'TRUCK-405',
      customerName: 'Dave Miller',
      address: 'First Hill Compactor',
      eventType: 'assigned',
      durationText: 'Scheduled'
    }
  ]);

  const prevPickupsRef = useRef<PickupRequest[]>(pickups);

  useEffect(() => {
    const prevPickups = prevPickupsRef.current;
    if (!prevPickups) {
      prevPickupsRef.current = pickups;
      return;
    }

    pickups.forEach(curr => {
      const prev = prevPickups.find(p => p.id === curr.id);
      
      if (prev) {
        // 1. Driver assignment changed
        if (curr.driverId && curr.driverId !== prev.driverId) {
          const driver = drivers.find(d => d.id === curr.driverId);
          if (driver) {
            setTimeline(prevTimeline => [
              {
                id: `live-assign-${Date.now()}-${curr.id}`,
                timestamp: new Date().toISOString(),
                driverId: curr.driverId!,
                driverName: driver.name,
                vehicleNumber: driver.vehicleNumber,
                pickupId: curr.id,
                customerName: curr.customerName,
                address: curr.address,
                eventType: 'assigned',
                durationText: 'Pending Dispatch'
              },
              ...prevTimeline
            ]);
          }
        }

        // 2. Status changed
        if (curr.status !== prev.status) {
          const driver = drivers.find(d => d.id === curr.driverId) || drivers[0];
          if (driver) {
            let durationText = '';
            if (curr.status === 'en_route') {
              durationText = 'Transit Active (Est. trip: 12-15 mins)';
            } else if (curr.status === 'completed') {
              durationText = `Trip completed in 14 mins (Shift active: 4h 30m)`;
            }

            setTimeline(prevTimeline => [
              {
                id: `live-status-${Date.now()}-${curr.id}`,
                timestamp: new Date().toISOString(),
                driverId: curr.driverId || 'unknown',
                driverName: driver.name,
                vehicleNumber: driver.vehicleNumber,
                pickupId: curr.id,
                customerName: curr.customerName,
                address: curr.address,
                eventType: curr.status === 'en_route' ? 'dispatched' : curr.status === 'completed' ? 'completed' : 'cancelled',
                durationText
              },
              ...prevTimeline
            ]);
          }
        }
      } else {
        // Brand new pickup request
        if (curr.driverId) {
          const driver = drivers.find(d => d.id === curr.driverId);
          if (driver) {
            setTimeline(prevTimeline => [
              {
                id: `live-new-assign-${Date.now()}-${curr.id}`,
                timestamp: new Date().toISOString(),
                driverId: curr.driverId!,
                driverName: driver.name,
                vehicleNumber: driver.vehicleNumber,
                pickupId: curr.id,
                customerName: curr.customerName,
                address: curr.address,
                eventType: 'assigned',
                durationText: 'Pending Dispatch'
              },
              ...prevTimeline
            ]);
          }
        }
      }
    });

    prevPickupsRef.current = pickups;
  }, [pickups, drivers]);

  const filteredTimeline = timeline.filter(event => timelineFilter === 'all' || event.eventType === timelineFilter);

  // Register driver form states
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [newDriverName, setNewDriverName] = useState('');
  const [newVehicleNumber, setNewVehicleNumber] = useState('');
  const [newVehicleType, setNewVehicleType] = useState('Heavy Compactor');
  const [newVehicleCapacity, setNewVehicleCapacity] = useState<number>(6000);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // Math Metrics
  const totalRevenue = payments.reduce((sum, tx) => sum + tx.amount, 0);
  const averageQuote = pickups.length > 0 ? pickups.reduce((sum, p) => sum + p.agreedSum, 0) / pickups.length : 0;
  
  // Calculate approximate completed weight based on some factor
  const completedPickupsCount = pickups.filter(p => p.status === 'completed').length;
  const estimatedCollectedWeight = completedPickupsCount * 45.2; // 45.2kg average payload per full bin size

  const fullBinsCount = bins.filter(b => b.fillLevel >= 85).length;
  const warningBinsCount = bins.filter(b => b.fillLevel >= 50 && b.fillLevel < 85).length;

  // Map Coordinates bounds calculations to render custom 2D grid representation
  // Seattle Lat range roughly: 47.600 to 47.628
  // Seattle Lng range roughly: -122.355 to -122.312
  const getMapCoords = (lat: number, lng: number) => {
    const latMin = 47.600;
    const latMax = 47.628;
    const lngMin = -122.355;
    const lngMax = -122.312;

    const x = ((lng - lngMin) / (lngMax - lngMin)) * 100;
    const y = (1 - (lat - latMin) / (latMax - latMin)) * 100; // Invert Y for screen coordinates

    return {
      left: `${Math.max(5, Math.min(95, x))}%`,
      top: `${Math.max(5, Math.min(95, y))}%`
    };
  };

  const getMapCoordsNum = (lat: number, lng: number) => {
    const latMin = 47.600;
    const latMax = 47.628;
    const lngMin = -122.355;
    const lngMax = -122.312;

    const x = ((lng - lngMin) / (lngMax - lngMin)) * 100;
    const y = (1 - (lat - latMin) / (latMax - latMin)) * 100;

    return {
      x: Math.max(5, Math.min(95, x)),
      y: Math.max(5, Math.min(95, y))
    };
  };

  const getGridPath = (x1: number, y1: number, x2: number, y2: number) => {
    // Elegant 2-turn grid step routing path
    const midX = x1 + (x2 - x1) * 0.5;
    return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
  };

  const handleRegisterDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriverName || !newVehicleNumber) return;

    setRegisterError(null);
    // Seattle depot central coordinate
    const depotLat = 47.6042;
    const depotLng = -122.3302;

    const success = await onRegisterDriver(
      newDriverName,
      newVehicleNumber,
      newVehicleType,
      newVehicleCapacity,
      depotLat,
      depotLng
    );

    if (success) {
      setRegisterSuccess(true);
      setTimeout(() => {
        setRegisterSuccess(false);
        setShowAddDriver(false);
        setNewDriverName('');
        setNewVehicleNumber('');
        setNewVehicleType('Heavy Compactor');
        setNewVehicleCapacity(6000);
      }, 2000);
    } else {
      setRegisterError('Unable to register vehicle. Credentials or plates format invalid.');
    }
  };

  return (
    <div className="space-y-8">
      
      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Company Gross Revenue</span>
            <span className="text-2xl font-black text-slate-800 mt-1 block">₦{totalRevenue.toLocaleString()}</span>
            <span className="text-xs text-emerald-500 font-bold flex items-center gap-0.5 mt-1">
              <ArrowUpRight className="w-3.5 h-3.5" /> Paystack Settlements
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Coins className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Est. Payload Recycled</span>
            <span className="text-2xl font-black text-slate-800 mt-1 block">{estimatedCollectedWeight.toFixed(1)} kg</span>
            <span className="text-xs text-slate-400 font-semibold mt-1 block">From {completedPickupsCount} finished runs</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <BarChart3 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Full Bins Alerting</span>
            <span className="text-2xl font-black text-slate-800 mt-1 block">{fullBinsCount} Bins</span>
            <span className="text-xs text-rose-500 font-bold flex items-center gap-0.5 mt-1">
              <ShieldAlert className="w-3.5 h-3.5" /> Sensors Triggered (85%+)
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Service Fleet Vehicles</span>
            <span className="text-2xl font-black text-slate-800 mt-1 block">{drivers.length} Units</span>
            <span className="text-xs text-indigo-500 font-bold block mt-1">
              {drivers.filter(d => d.status === 'en_route').length} Active En Route
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50/50 text-indigo-700 flex items-center justify-center">
            <Truck className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Grid: GPS Map Track (Left) & Control Panel desk (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* GPS Vector Interactive Map representation */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-indigo-600 animate-spin [animation-duration:20s]" />
              <h2 className="text-lg font-bold text-slate-800">Seattle GPS Logistics Network</h2>
            </div>
            
            <div className="flex flex-wrap gap-2.5">
              {/* Layer Selection */}
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg text-[10px] font-bold">
                <button
                  onClick={() => setMapLayer('all')}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer ${mapLayer === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  All Nodes
                </button>
                <button
                  onClick={() => setMapLayer('full')}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer ${mapLayer === 'full' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Full Bins (⚠️)
                </button>
                <button
                  onClick={() => setMapLayer('trucks')}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer ${mapLayer === 'trucks' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Vehicles Only
                </button>
              </div>

              {/* Mode Selection */}
              <div className="flex gap-1 bg-indigo-50/50 border border-indigo-100/35 p-1 rounded-lg text-[10px] font-bold text-slate-700">
                <button
                  onClick={() => setMapMode('standard')}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer ${mapMode === 'standard' ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-400 hover:text-indigo-600'}`}
                >
                  Standard
                </button>
                <button
                  onClick={() => setMapMode('heatmap')}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer ${mapMode === 'heatmap' ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-400 hover:text-indigo-600'}`}
                >
                  Heatmap
                </button>
                <button
                  onClick={() => setMapMode('routes')}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer ${mapMode === 'routes' ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-400 hover:text-indigo-600'}`}
                >
                  Routes
                </button>
              </div>
            </div>
          </div>

          <div className="relative aspect-video w-full rounded-xl bg-slate-950 border border-slate-950 overflow-hidden shadow-inner">
            {/* Grid street mock visual overlays */}
            <div className="absolute inset-0 opacity-15 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500 via-transparent to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#334155_1px,transparent_1px),linear-gradient(to_bottom,#334155_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-25 pointer-events-none" />
            
            {/* Mock Seattle geography landmarks */}
            <div className="absolute top-1/4 left-1/4 text-[8px] font-black tracking-widest text-slate-600 uppercase opacity-35 select-none pointer-events-none">PIKE PLACE HUB</div>
            <div className="absolute top-1/2 left-2/3 text-[8px] font-black tracking-widest text-slate-600 uppercase opacity-35 select-none pointer-events-none">FIRST HILL COMPACTOR</div>
            <div className="absolute bottom-1/4 left-1/3 text-[8px] font-black tracking-widest text-slate-600 uppercase opacity-35 select-none pointer-events-none">DEPOT HQ</div>

            {/* Customers Static Location Pin Markers */}
            {mapLayer !== 'trucks' && customers.map(cust => (
              <button
                id={`map-cust-btn-${cust.id}`}
                key={cust.id}
                onClick={() => setSelectedMapItem({ type: 'customer', data: cust })}
                className="absolute -translate-x-1/2 -translate-y-1/2 group z-10 transition-transform hover:scale-125 focus:outline-none cursor-pointer"
                style={getMapCoords(cust.lat, cust.lng)}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-slate-400 border border-slate-950 shadow" />
                <span className="absolute left-full ml-1.5 top-1/2 -translate-y-1/2 bg-slate-950/90 text-slate-300 font-mono text-[7px] font-bold py-0.5 px-1 rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                  Home: {cust.name}
                </span>
              </button>
            ))}

            {/* Bins Vector Markers */}
            {mapLayer !== 'trucks' && bins.map(bin => {
              const isFull = bin.fillLevel >= 85;
              const isWarning = bin.fillLevel >= 50 && bin.fillLevel < 85;
              
              if (mapLayer === 'full' && !isFull) return null;

              const markerColor = isFull ? 'bg-rose-500 ring-rose-500/30' : isWarning ? 'bg-amber-500 ring-amber-500/30' : 'bg-emerald-500 ring-emerald-500/30';

              return (
                <button
                  id={`map-bin-btn-${bin.id}`}
                  key={bin.id}
                  onClick={() => setSelectedMapItem({ type: 'bin', data: bin })}
                  className="absolute -translate-x-1/2 -translate-y-1/2 group z-10 transition-transform hover:scale-125 focus:outline-none cursor-pointer"
                  style={getMapCoords(bin.lat, bin.lng)}
                >
                  <div className={`w-3.5 h-3.5 rounded-full ${markerColor} border-2 border-slate-900 ring-4 animate-pulse duration-1000`} />
                  <span className="absolute left-full ml-1.5 top-1/2 -translate-y-1/2 bg-slate-950/90 text-white font-mono text-[8px] font-bold py-0.5 px-1.5 rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                    {bin.type}: {bin.fillLevel}%
                  </span>
                </button>
              );
            })}

            {/* Trucks/Drivers GPS Markers */}
            {mapLayer !== 'full' && drivers.map(driver => {
              const isEnRoute = driver.status === 'en_route';
              return (
                <button
                  id={`map-driver-btn-${driver.id}`}
                  key={driver.id}
                  onClick={() => setSelectedMapItem({ type: 'driver', data: driver })}
                  className="absolute -translate-x-1/2 -translate-y-1/2 group z-20 transition-transform hover:scale-125 focus:outline-none cursor-pointer"
                  style={getMapCoords(driver.currentLat, driver.currentLng)}
                >
                  <div className={`p-1.5 rounded-lg border border-indigo-400 bg-indigo-950 text-indigo-400 shadow-md ${isEnRoute ? 'animate-bounce' : ''}`}>
                    <Truck className="w-3.5 h-3.5" />
                  </div>
                  <span className="absolute left-full ml-1.5 top-1/2 -translate-y-1/2 bg-indigo-950/95 text-indigo-300 font-mono text-[8px] font-bold py-0.5 px-1.5 rounded border border-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                    {driver.name} ({driver.vehicleNumber})
                  </span>
                </button>
              );
            })}

            {/* Heatmap Layer Overlays */}
            {mapMode === 'heatmap' && mapLayer !== 'trucks' && bins.map(bin => {
              const coords = getMapCoords(bin.lat, bin.lng);
              let glowColor = 'bg-emerald-500/10';
              let glowSize = 'w-8 h-8';
              if (bin.fillLevel >= 85) {
                glowColor = 'bg-rose-500/35 animate-pulse';
                glowSize = 'w-16 h-16';
              } else if (bin.fillLevel >= 50) {
                glowColor = 'bg-amber-500/25';
                glowSize = 'w-12 h-12';
              }
              return (
                <div
                  key={`heatmap-${bin.id}`}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full blur-md pointer-events-none transition-all duration-1000 ${glowSize} ${glowColor}`}
                  style={coords}
                />
              );
            })}

            {/* Real-time Grid Routed Paths */}
            {mapMode === 'routes' && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                {drivers.map(driver => {
                  if (driver.status === 'en_route' && driver.targetLat && driver.targetLng) {
                    const start = getMapCoordsNum(driver.currentLat, driver.currentLng);
                    const end = getMapCoordsNum(driver.targetLat, driver.targetLng);
                    const pathD = getGridPath(start.x, start.y, end.x, end.y);
                    const isSelected = selectedRouteId === driver.id;

                    return (
                      <g key={`route-g-${driver.id}`}>
                        {/* Glowing shadow line */}
                        <path
                          d={pathD}
                          fill="none"
                          stroke={isSelected ? "#10b981" : "#6366f1"}
                          strokeWidth={isSelected ? "5" : "3"}
                          className="opacity-25 blur-[1px]"
                        />
                        {/* Animated dash line */}
                        <path
                          d={pathD}
                          fill="none"
                          stroke={isSelected ? "#10b981" : "#818cf8"}
                          strokeWidth={isSelected ? "3" : "1.5"}
                          strokeDasharray="5,5"
                          className="animate-dash"
                        />
                        {/* Destination beacon */}
                        <circle
                          cx={`${end.x}%`}
                          cy={`${end.y}%`}
                          r={isSelected ? "8" : "5"}
                          fill="none"
                          stroke={isSelected ? "#10b981" : "#818cf8"}
                          strokeWidth="2"
                          className="animate-ping"
                        />
                      </g>
                    );
                  }
                  return null;
                })}
              </svg>
            )}

            {/* Default/Standard Straight Paths */}
            {mapMode === 'standard' && drivers.map(driver => {
              if (driver.status === 'en_route' && driver.targetLat && driver.targetLng) {
                const start = getMapCoords(driver.currentLat, driver.currentLng);
                const end = getMapCoords(driver.targetLat, driver.targetLng);
                return (
                  <svg key={driver.id} className="absolute inset-0 w-full h-full pointer-events-none z-0">
                    <line
                      x1={start.left}
                      y1={start.top}
                      x2={end.left}
                      y2={end.top}
                      stroke="#818cf8"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                      className="animate-dash"
                    />
                  </svg>
                );
              }
              return null;
            })}
          </div>

          {/* Map Item Detail Footer Panel */}
          {selectedMapItem && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-start">
              {selectedMapItem.type === 'bin' ? (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Monitored Smart Bin Details</span>
                  <h4 className="font-bold text-slate-800 text-sm mt-1">{selectedMapItem.data.ownerName}'s Bin</h4>
                  <p className="text-xs text-slate-500 mt-1">{selectedMapItem.data.address}</p>
                  <div className="flex gap-4 mt-2">
                    <span className="text-xs font-semibold text-slate-600">Category: <span className="font-bold text-slate-800">{selectedMapItem.data.type}</span></span>
                    <span className="text-xs font-semibold text-slate-600">Fill Level: <span className={`font-bold ${selectedMapItem.data.fillLevel >= 85 ? 'text-rose-600' : 'text-slate-800'}`}>{selectedMapItem.data.fillLevel}%</span></span>
                  </div>
                </div>
              ) : selectedMapItem.type === 'driver' ? (
                <div>
                  <span className="text-[10px] font-bold text-indigo-400 uppercase block">Vehicle Telemetry</span>
                  <h4 className="font-bold text-slate-800 text-sm mt-1">Driver: {selectedMapItem.data.name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Vehicle License Plate: <span className="font-mono font-bold text-slate-700">{selectedMapItem.data.vehicleNumber}</span></p>
                  <p className="text-xs text-slate-500 mt-0.5">Classification Type: {selectedMapItem.data.vehicleType || 'Heavy Compactor'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Payload Capacity Limit: <span className="font-semibold text-slate-800">{(selectedMapItem.data.vehicleCapacityKg || 6000).toLocaleString()} kg</span></p>
                  <div className="flex gap-3 mt-2 text-xs">
                    <span className="font-semibold text-slate-600">Status: <span className="font-bold text-indigo-600 capitalize">{selectedMapItem.data.status}</span></span>
                    <span className="font-semibold text-slate-600">Lat: {selectedMapItem.data.currentLat.toFixed(4)}</span>
                    <span className="font-semibold text-slate-600">Lng: {selectedMapItem.data.currentLng.toFixed(4)}</span>
                  </div>
                </div>
              ) : (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Customer Account</span>
                  <h4 className="font-bold text-slate-800 text-sm mt-1">{selectedMapItem.data.name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Base Station: {selectedMapItem.data.address}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Phone: {selectedMapItem.data.phone}</p>
                </div>
              )}
              <button onClick={() => setSelectedMapItem(null)} className="text-slate-400 hover:text-slate-600 text-xs font-bold">Close details</button>
            </div>
          )}

          {/* Active Routes Panel (Only visible in Routes mode) */}
          {mapMode === 'routes' && (
            <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 space-y-3.5 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Active Routing Transits</h3>
                </div>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-mono py-0.5 px-2 rounded-full border border-emerald-500/20">
                  {drivers.filter(d => d.status === 'en_route').length} Live Vehicles
                </span>
              </div>

              {drivers.filter(d => d.status === 'en_route').length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">
                  No active dispatch routes. Use the "Dispatch Fleet" controls on the right panel to launch collection vehicles.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
                  {drivers.filter(d => d.status === 'en_route').map(driver => {
                    const activePickup = pickups.find(p => p.driverId === driver.id && p.status === 'en_route');
                    
                    // Math remaining distance & time
                    let distText = 'Calculating...';
                    let estMin = 0;
                    if (driver.targetLat && driver.targetLng) {
                      const dLat = driver.targetLat - driver.currentLat;
                      const dLng = driver.targetLng - driver.currentLng;
                      const distance = Math.sqrt(dLat * dLat + dLng * dLng);
                      const distanceKm = distance * 111 * 1.3; // 1 degree lat is ~111km, 1.3 street factor
                      distText = distanceKm < 0.1 ? 'Arrived at target' : `${distanceKm.toFixed(2)} km`;
                      estMin = Math.ceil(distanceKm / 0.3); // moving at ~18 km/h or 0.3km/min
                    }

                    const isSelected = selectedRouteId === driver.id;

                    return (
                      <div
                        key={`route-card-${driver.id}`}
                        onClick={() => setSelectedRouteId(isSelected ? null : driver.id)}
                        className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-emerald-950/40 border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                            : 'bg-slate-950/45 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-xs text-white">{driver.name}</div>
                            <span className="font-mono text-[9px] text-slate-500 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded block w-fit mt-0.5">{driver.vehicleNumber}</span>
                          </div>
                          <span className="text-[9px] bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded font-bold uppercase shrink-0">
                            {driver.vehicleType ? driver.vehicleType.split(' ')[0] : 'Heavy'}
                          </span>
                        </div>

                        {activePickup && (
                          <div className="mt-2 pt-2 border-t border-slate-800/60 text-[10px] text-slate-400 space-y-1">
                            <p className="truncate"><strong className="text-slate-300 font-medium">To:</strong> {activePickup.customerName} ({activePickup.binType})</p>
                            <p className="truncate text-[9px] text-slate-500">{activePickup.address}</p>
                            <div className="flex justify-between items-center mt-2 pt-1 border-t border-slate-800/30 text-[9px]">
                              <span>Dist: <strong className="text-emerald-400 font-mono">{distText}</strong></span>
                              <span>ETA: <strong className="text-amber-400 font-mono">{estMin > 0 ? `${estMin} mins` : 'Arrived'}</strong></span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dispatch Control Desk panel */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800">Dispatch & Router Control</h2>
            <button
              id="admin-sync-btn"
              onClick={onRefresh}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded bg-slate-100"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
            {pickups.length === 0 ? (
              <div className="p-8 text-center bg-white border border-slate-200 rounded-xl">
                <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-400 text-xs font-medium">No active or pending disposal tickets.</p>
              </div>
            ) : (
              pickups.map(pickup => {
                const assignedDriver = drivers.find(d => d.id === pickup.driverId);
                const isPaid = pickup.paymentStatus === 'paid';

                return (
                  <div id={`admin-ticket-${pickup.id}`} key={pickup.id} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm space-y-3 hover:border-slate-300 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-extrabold text-slate-800">{pickup.customerName}</span>
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                            pickup.status === 'completed' ? 'bg-slate-100 text-slate-600' :
                            pickup.status === 'en_route' ? 'bg-emerald-50 text-emerald-700 animate-pulse' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {pickup.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[200px]" title={pickup.address}>
                          {pickup.address}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-black text-slate-700 block">₦{pickup.agreedSum.toLocaleString()}</span>
                        <span className={`text-[9px] font-bold ${isPaid ? 'text-emerald-600' : 'text-amber-500'}`}>
                          {isPaid ? '● Settled via Paystack' : '● Awaiting Settlement'}
                        </span>
                      </div>
                    </div>

                    {/* Controls desk */}
                    {pickup.status !== 'completed' && pickup.status !== 'cancelled' && (
                      <div className="bg-slate-50 p-2.5 rounded-lg flex flex-col sm:flex-row sm:items-end justify-between gap-3 text-xs border border-slate-100">
                        
                        {/* Driver selection dropdown */}
                        <div className="flex-1">
                          <span className="text-[9px] font-extrabold text-slate-400 uppercase block mb-1">Assign Fleet Crew</span>
                          <select
                            id={`assign-driver-select-${pickup.id}`}
                            value={pickup.driverId || ''}
                            onChange={(e) => onAssignDriver(pickup.id, e.target.value)}
                            className="w-full bg-white border border-slate-200 text-slate-700 text-xs py-1 px-1.5 rounded focus:outline-none"
                          >
                            <option value="">Select Crew...</option>
                            {drivers.map(drv => (
                              <option key={drv.id} value={drv.id}>
                                {drv.name} ({drv.vehicleType || 'Heavy'} - Capacity: {drv.vehicleCapacityKg || 6000}kg) {drv.status === 'en_route' ? '[En Route]' : '[Available]'}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Dispatch action button */}
                        {pickup.status === 'scheduled' && pickup.driverId ? (
                          <button
                            id={`dispatch-btn-${pickup.id}`}
                            onClick={() => onDispatchDriver(pickup.id)}
                            className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-[10px] cursor-pointer shadow-sm transition-all flex items-center gap-1 shrink-0"
                          >
                            <Navigation className="w-3 h-3" />
                            <span>Dispatch Fleet</span>
                          </button>
                        ) : pickup.status === 'en_route' ? (
                          <div className="text-[9px] text-indigo-600 font-bold flex items-center gap-1 animate-pulse shrink-0">
                            <Navigation className="w-3 h-3 rotate-45" />
                            <span>Tracking GPS</span>
                          </div>
                        ) : (
                          <div className="text-[9px] text-slate-400 font-medium italic shrink-0">
                            {!isPaid ? 'Awaiting customer checkout' : 'Assign crew to dispatch'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Fleet Registration & Capacity management Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-extrabold text-slate-800">Fleet Operations & Payload Register</h3>
          </div>
          
          <button
            onClick={() => setShowAddDriver(true)}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Register Driver & Vehicle</span>
          </button>
        </div>

        {/* Add Driver Modal overlay */}
        {showAddDriver && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="text-base font-extrabold text-slate-800">Register Driver & Hauler</h3>
                <button onClick={() => setShowAddDriver(false)} className="text-slate-400 hover:text-slate-600 text-sm font-semibold">✕</button>
              </div>

              {registerSuccess ? (
                <div className="py-6 text-center space-y-3">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <Check className="w-6 h-6 stroke-[3]" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">Vehicle Registered Successfully</h4>
                  <p className="text-xs text-slate-400">Hauler has been cataloged in Seattle centralized routing node.</p>
                </div>
              ) : (
                <form onSubmit={handleRegisterDriverSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Driver's Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Marcus Vance"
                      value={newDriverName}
                      onChange={(e) => setNewDriverName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">License Plate Number</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. WA-993-XLR"
                      value={newVehicleNumber}
                      onChange={(e) => setNewVehicleNumber(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Vehicle Classification</label>
                      <select
                        value={newVehicleType}
                        onChange={(e) => setNewVehicleType(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none"
                      >
                        <option value="Heavy Compactor">Heavy Compactor</option>
                        <option value="Compact Compactor">Compact Compactor</option>
                        <option value="Eco Flatbed">Eco Flatbed</option>
                        <option value="Hazardous Tanker">Hazardous Tanker</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Payload Max Capacity (kg)</label>
                      <input
                        type="number"
                        min="500"
                        max="20000"
                        value={newVehicleCapacity}
                        onChange={(e) => setNewVehicleCapacity(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {registerError && (
                    <div className="p-3 bg-rose-50 text-rose-700 rounded-lg text-xs leading-normal">
                      {registerError}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition-all cursor-pointer"
                  >
                    Submit Registry Entry
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Drivers & Vehicles Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                <th className="p-3">Crew Member</th>
                <th className="p-3">Vehicle License Plate</th>
                <th className="p-3">Type</th>
                <th className="p-3">Payload Capacity</th>
                <th className="p-3">Coordinates (Live GPS)</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="text-xs text-slate-600 font-medium">
              {drivers.map(drv => {
                const isEnRoute = drv.status === 'en_route';
                return (
                  <tr key={drv.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="p-3">
                      <div className="font-bold text-slate-800">{drv.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">ID: {drv.id}</div>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-700">{drv.vehicleNumber}</td>
                    <td className="p-3">{drv.vehicleType || 'Heavy Compactor'}</td>
                    <td className="p-3">
                      <span className="font-bold text-slate-700">{(drv.vehicleCapacityKg || 6000).toLocaleString()} kg</span>
                    </td>
                    <td className="p-3 font-mono text-slate-500 text-[11px]">
                      {drv.currentLat.toFixed(5)}, {drv.currentLng.toFixed(5)}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        isEnRoute ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}>
                        {drv.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dynamic Logs & Audit Ledger Double Desk Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
        
        {/* Fleet Assignment Timeline */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col h-[520px]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600 animate-pulse" />
              <div>
                <h3 className="text-base font-extrabold text-slate-800">Fleet Dispatch & Assignment Timeline</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Real-time shift tracking & telemetry logging</p>
              </div>
            </div>

            {/* Timeline Filter */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg text-[9px] font-bold shrink-0 self-start sm:self-center">
              {(['all', 'assigned', 'dispatched', 'completed'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setTimelineFilter(type)}
                  className={`px-2 py-0.5 rounded cursor-pointer capitalize transition-all ${
                    timelineFilter === type ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Timeline Content */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            {filteredTimeline.length === 0 ? (
              <p className="text-slate-400 text-xs italic py-12 text-center">No matching assignment timeline logs.</p>
            ) : (
              <div className="relative border-l border-slate-100 ml-3 pl-5 space-y-5 py-1">
                {filteredTimeline.map(event => {
                  let badgeColor = 'bg-slate-50 text-slate-600 border-slate-200';
                  let dotColor = 'bg-slate-300 ring-slate-100';

                  if (event.eventType === 'assigned') {
                    badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-100';
                    dotColor = 'bg-indigo-500 ring-indigo-100';
                  } else if (event.eventType === 'dispatched') {
                    badgeColor = 'bg-amber-50 text-amber-700 border-amber-100';
                    dotColor = 'bg-amber-500 ring-amber-100';
                  } else if (event.eventType === 'completed') {
                    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                    dotColor = 'bg-emerald-500 ring-emerald-100';
                  }

                  return (
                    <div key={event.id} className="relative group">
                      {/* Interactive step marker */}
                      <span className={`absolute -left-[27.5px] top-1.5 rounded-full w-3.5 h-3.5 flex items-center justify-center border border-white text-white ${dotColor} ring-4 transition-transform group-hover:scale-125 shadow-sm`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      </span>

                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 bg-slate-50/40 hover:bg-slate-50 border border-slate-100 hover:border-slate-200 p-3 rounded-xl transition-all">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-black text-slate-800">{event.driverName}</span>
                            <span className="text-[10px] text-slate-500 font-mono">({event.vehicleNumber})</span>
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border uppercase tracking-wider ${badgeColor}`}>
                              {event.eventType}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600">
                            {event.eventType === 'assigned' && `Assigned to customer ${event.customerName || 'N/A'}'s pickup request.`}
                            {event.eventType === 'dispatched' && `Dispatched and en route to ${event.customerName || 'N/A'} at ${event.address || 'N/A'}.`}
                            {event.eventType === 'completed' && `Successfully completed trash collection at ${event.address || 'N/A'}.`}
                          </p>

                          {event.durationText && (
                            <span className="text-[9px] text-indigo-600 font-bold block mt-1 bg-indigo-50/50 px-2 py-0.5 rounded-md w-fit">
                              ⏱️ {event.durationText}
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] text-slate-400 font-bold font-mono self-start shrink-0">
                          {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Financial Ledger Audits */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col h-[520px]">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-base font-extrabold text-slate-800">Financial Ledger Audits</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Verified Paystack settlement transactions</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
            {payments.length === 0 ? (
              <p className="text-slate-400 text-xs font-semibold text-center py-12">No transactions recorded.</p>
            ) : (
              payments.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-3.5 border border-slate-100 hover:bg-slate-50 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                      ₦
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">{tx.customerName}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{new Date(tx.date).toLocaleDateString()} at {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-black text-slate-800">+₦{tx.amount.toLocaleString()}</span>
                    <span className="text-[9px] text-emerald-600 font-bold block">Settled (Paystack capture)</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
