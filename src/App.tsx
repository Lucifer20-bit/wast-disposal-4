import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Truck, Sparkles, Building2, User, Globe, AlertCircle, RefreshCw, BarChart3, HelpCircle, X, Mail } from 'lucide-react';
import { Bin, PickupRequest, Driver, PaymentTransaction, AIAnalysisResult, Customer } from './types';
import CustomerPortal from './components/CustomerPortal';
import AdminPortal from './components/AdminPortal';
import { motion, AnimatePresence } from 'motion/react';

interface ToastNotification {
  id: string;
  to: string;
  customerName: string;
  subject: string;
  body: string;
  timestamp: string;
  createdAt: number;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'customer' | 'admin'>('customer');
  const [bins, setBins] = useState<Bin[]>([]);
  const [pickups, setPickups] = useState<PickupRequest[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeCustomerId, setActiveCustomerId] = useState<string>('cust-1');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);
  const prevPickupsRef = useRef<PickupRequest[]>([]);

  // Core Sync Function to fetch state from full-stack backend Express endpoints
  const syncState = async () => {
    try {
      const safeJsonFetch = async (url: string, fallbackData: any) => {
        try {
          const res = await fetch(url);
          if (!res.ok) {
            console.warn(`HTTP error on ${url}: status ${res.status}`);
            return fallbackData;
          }
          const contentType = res.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            console.warn(`Non-JSON response received for ${url}: ${contentType || "none"}`);
            return fallbackData;
          }
          return await res.json();
        } catch (err) {
          console.error(`Fetch failure on ${url}:`, err);
          return fallbackData;
        }
      };

      const [binsData, pickupsData, driversData, paymentsData, customersData] = await Promise.all([
        safeJsonFetch('/api/bins', bins),
        safeJsonFetch('/api/pickups', pickups),
        safeJsonFetch('/api/drivers', drivers),
        safeJsonFetch('/api/payments', payments),
        safeJsonFetch('/api/customers', customers)
      ]);

      setBins(binsData);
      setPickups(pickupsData);
      setDrivers(driversData);
      setPayments(paymentsData);
      setCustomers(customersData);
      setError(null);
    } catch (err: any) {
      console.error('Telemetry Sync Failure:', err);
      setError('Unable to link with EcoCycle Cloud Services. Retrying...');
    } finally {
      setLoading(false);
    }
  };

  // Initial Sync and live polling interval
  useEffect(() => {
    syncState();
    
    // Live polling every 2 seconds for smooth real-time simulation updates
    const interval = setInterval(() => {
      syncState();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Monitor pickup status transitions to 'completed' and trigger mock email toast alerts
  useEffect(() => {
    if (prevPickupsRef.current && prevPickupsRef.current.length > 0 && pickups.length > 0) {
      pickups.forEach(pickup => {
        const prev = prevPickupsRef.current.find(p => p.id === pickup.id);
        const prevStatus = prev ? prev.status : null;
        
        // If transitioned to completed
        if (pickup.status === 'completed' && prevStatus !== 'completed') {
          // Find customer email or construct default
          const customer = customers.find(c => c.name === pickup.customerName);
          const email = customer ? customer.email : `${pickup.customerName.toLowerCase().replace(/\s+/g, '')}@gmail.com`;
          
          const newNotification: ToastNotification = {
            id: `toast-${Date.now()}-${pickup.id}`,
            to: email,
            customerName: pickup.customerName,
            subject: `📧 [Completed] Smart Waste Pickup for ${pickup.binType} is Complete!`,
            body: `Hi ${pickup.customerName},\n\nWe are pleased to inform you that our driver team has successfully completed the smart disposal pickup for your ${pickup.binType} waste at ${pickup.address}.\n\nTotal Service Charge Settled: ₦${pickup.agreedSum.toLocaleString()}.\n\nThank you for partnering with EcoCycle for sustainable recycling!`,
            timestamp: new Date().toLocaleTimeString(),
            createdAt: Date.now()
          };
          
          setNotifications(prev => [newNotification, ...prev]);
        }
      });
    }
    
    // Maintain state snapshot
    prevPickupsRef.current = JSON.parse(JSON.stringify(pickups));
  }, [pickups, customers]);

  // Clean up notifications after 9 seconds automatically
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setNotifications(prev => prev.filter(n => now - n.createdAt < 9000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Update a bin's fill level (Simulation Panel)
  const handleUpdateFillLevel = async (binId: string, level: number) => {
    try {
      const response = await fetch(`/api/bins/${binId}/fill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fillLevel: level })
      });
      if (response.ok) {
        await syncState();
      }
    } catch (err) {
      console.error('Failed to simulate sensor level:', err);
    }
  };

  // Trigger manual notification alert that a bin is full
  const handleNotifyCompany = async (binId: string) => {
    try {
      const response = await fetch(`/api/bins/${binId}/notify`, {
        method: 'POST'
      });
      if (response.ok) {
        await syncState();
      }
    } catch (err) {
      console.error('Failed to dispatch alert notification:', err);
    }
  };

  // Register a new customer smart bin
  const handleAddBin = async (
    type: 'General' | 'Recycling' | 'Organic' | 'Hazardous' | 'Electronic',
    gallons: number,
    ownerName: string,
    address: string,
    lat: number,
    lng: number
  ) => {
    try {
      const response = await fetch('/api/bins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerName,
          type,
          sizeGallons: gallons,
          address,
          lat,
          lng
        })
      });
      if (response.ok) {
        await syncState();
      }
    } catch (err) {
      console.error('Failed to register smart bin:', err);
    }
  };

  // Update an existing bin
  const handleUpdateBin = async (
    binId: string,
    type: 'General' | 'Recycling' | 'Organic' | 'Hazardous' | 'Electronic',
    gallons: number,
    address: string,
    lat: number,
    lng: number
  ) => {
    try {
      const response = await fetch(`/api/bins/${binId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          sizeGallons: gallons,
          address,
          lat,
          lng
        })
      });
      if (response.ok) {
        await syncState();
      }
    } catch (err) {
      console.error('Failed to update smart bin:', err);
    }
  };

  // Delete/unregister a smart bin
  const handleDeleteBin = async (binId: string) => {
    try {
      const response = await fetch(`/api/bins/${binId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        await syncState();
      }
    } catch (err) {
      console.error('Failed to unregister smart bin:', err);
    }
  };

  // Create a custom/manual pickup request for a bin
  const handleCreatePickupRequest = async (
    binId: string,
    customerName: string,
    address: string,
    lat: number,
    lng: number,
    binType: 'General' | 'Recycling' | 'Organic' | 'Hazardous' | 'Electronic',
    fillLevel: number,
    agreedSum: number
  ) => {
    try {
      const response = await fetch('/api/pickups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          binId,
          customerName,
          address,
          lat,
          lng,
          binType,
          fillLevel,
          agreedSum
        })
      });
      if (response.ok) {
        await syncState();
      }
    } catch (err) {
      console.error('Failed to request manual pickup:', err);
    }
  };

  // Register a new Customer profile
  const handleRegisterCustomer = async (
    name: string,
    email: string,
    phone: string,
    address: string,
    lat: number,
    lng: number
  ) => {
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, address, lat, lng })
      });
      if (response.ok) {
        const newCust = await response.json();
        await syncState();
        setActiveCustomerId(newCust.id);
        return newCust;
      }
    } catch (err) {
      console.error('Failed to register customer profile:', err);
    }
    return null;
  };

  // Register a new Driver / Vehicle
  const handleRegisterDriver = async (
    name: string,
    vehicleNumber: string,
    vehicleType: string,
    vehicleCapacityKg: number,
    currentLat: number,
    currentLng: number
  ) => {
    try {
      const response = await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, vehicleNumber, vehicleType, vehicleCapacityKg, currentLat, currentLng })
      });
      if (response.ok) {
        await syncState();
        return true;
      }
    } catch (err) {
      console.error('Failed to register driver & vehicle:', err);
    }
    return false;
  };

  // Process secure automated payment settlement (Card, Bank Transfer, bank)
  const handleProcessPayment = async (pickupId: string, amount: number, paymentDetails: any) => {
    try {
      const response = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupId,
          amount,
          cardNumber: paymentDetails.cardNumber,
          expiry: paymentDetails.expiry,
          cvc: paymentDetails.cvc,
          customerName: paymentDetails.customerName,
          binType: paymentDetails.binType,
          paymentMethod: paymentDetails.paymentMethod
        })
      });

      if (response.ok) {
        await syncState();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Checkout payment failed:', err);
      return false;
    }
  };

  // Schedule disposal pickup for AI Smart Quote Analyser
  const handleScheduleAIPickup = async (analysis: AIAnalysisResult, customer: Customer) => {
    try {
      const response = await fetch('/api/pickups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customer.name,
          address: customer.address,
          lat: customer.lat,
          lng: customer.lng,
          binType: analysis.wasteCategory,
          fillLevel: analysis.estimatedFullness,
          agreedSum: analysis.agreedSum
        })
      });
      if (response.ok) {
        await syncState();
      }
    } catch (err) {
      console.error('Failed to file AI disposal booking:', err);
    }
  };

  // Admin: Assign driver/crew to ticket
  const handleAssignDriver = async (pickupId: string, driverId: string) => {
    try {
      const response = await fetch(`/api/pickups/${pickupId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId })
      });
      if (response.ok) {
        await syncState();
      }
    } catch (err) {
      console.error('Failed to assign driver:', err);
    }
  };

  // Admin: Dispatch driver (starts active transit simulation)
  const handleDispatchDriver = async (pickupId: string) => {
    try {
      const response = await fetch(`/api/pickups/${pickupId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'en_route', driverId: pickups.find(p => p.id === pickupId)?.driverId })
      });
      if (response.ok) {
        await syncState();
      }
    } catch (err) {
      console.error('Failed to dispatch driver route:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex text-slate-800 font-sans">
      
      {/* Left Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-slate-400 flex flex-col border-r border-slate-800 shrink-0 hidden lg:flex">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center text-slate-900 font-extrabold">E</div>
          <span className="text-white font-black text-xl tracking-tight">EcoCycle <span className="text-emerald-400">Pro</span></span>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-6">
          <div className="px-3 py-1 text-[10px] font-bold uppercase text-slate-500 tracking-wider">Fleet & Customer</div>
          
          <button
            id="sidebar-customer-btn"
            onClick={() => setActiveTab('customer')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-left ${
              activeTab === 'customer'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                : 'hover:bg-slate-800 hover:text-white border border-transparent'
            }`}
          >
            <User className="w-4 h-4 shrink-0" />
            <span>Customer Portal</span>
          </button>

          <button
            id="sidebar-admin-btn"
            onClick={() => setActiveTab('admin')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-left ${
              activeTab === 'admin'
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm'
                : 'hover:bg-slate-800 hover:text-white border border-transparent'
            }`}
          >
            <Building2 className="w-4 h-4 shrink-0" />
            <span>Disposal Dashboard</span>
          </button>

          <div className="pt-6 px-3 py-1 text-[10px] font-bold uppercase text-slate-500 tracking-wider">District Systems</div>
          <div className="px-3 py-2 text-xs text-slate-400 flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-emerald-500 animate-spin [animation-duration:8s]" />
            <span>Seattle Active Grid</span>
          </div>
        </nav>

        {/* Sidebar System Status */}
        <div className="p-4 border-t border-slate-800 mt-auto">
          <div className="bg-slate-800 p-3 rounded-lg">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Telemetry Engine</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs text-white font-medium">All Systems Active</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Stage container */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        
        {/* Top Header Navigation bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <div className="lg:hidden flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center text-slate-900 font-extrabold text-xs">E</div>
              <span className="text-slate-950 font-black text-sm tracking-tight">EcoCycle</span>
            </div>
            
            <h2 className="text-sm lg:text-base font-bold text-slate-800">
              {activeTab === 'customer' ? 'Customer Workspace' : 'Operations Center'}
            </h2>
            <div className="hidden sm:block h-4 w-px bg-slate-200"></div>
            <div className="hidden sm:block text-xs text-slate-500">
              Last sync: Live Telemetry Connected
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick Portal Switcher buttons on small screen, and a subtle tab pill indicator */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                id="tab-customer-btn"
                onClick={() => setActiveTab('customer')}
                className={`py-1.5 px-3 rounded-md font-bold text-xs transition-all cursor-pointer ${
                  activeTab === 'customer'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Customer
              </button>
              <button
                id="tab-admin-btn"
                onClick={() => setActiveTab('admin')}
                className={`py-1.5 px-3 rounded-md font-bold text-xs transition-all cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Operations
              </button>
            </div>

            <div className="h-5 w-px bg-slate-200"></div>

            <div className="flex items-center gap-2">
              <div className="text-right hidden md:block">
                <p className="text-xs font-semibold leading-none text-slate-700">Console Admin</p>
                <p className="text-[10px] text-slate-400 leading-none mt-1">Bonaventure (You)</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-xs font-bold text-slate-700 select-none">
                B
              </div>
            </div>
          </div>
        </header>

        {/* Main page content layout padding */}
        <main className="flex-1 p-4 md:p-8 space-y-6">
          {error && (
            <div className="mb-6 flex items-center gap-2.5 p-4 bg-amber-50 text-amber-800 rounded-2xl text-xs border border-amber-100 shadow-sm">
              <AlertCircle className="w-4.5 h-4.5 shrink-0 text-amber-500" />
              <span className="font-semibold">{error}</span>
              <button onClick={syncState} className="ml-auto flex items-center gap-1 hover:underline text-emerald-700">
                <RefreshCw className="w-3.5 h-3.5" /> Reconnect
              </button>
            </div>
          )}

          {loading ? (
            <div className="min-h-[50vh] flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center animate-bounce shadow-md">
                🔄
              </div>
              <div>
                <h3 className="text-slate-700 font-bold text-sm">Synchronizing Grid Telemetry</h3>
                <p className="text-slate-400 text-xs mt-1">Downloading live sensor indexes, routing positions, and billing database...</p>
              </div>
            </div>
          ) : activeTab === 'customer' ? (
            <CustomerPortal
              bins={bins}
              pickups={pickups}
              payments={payments}
              customers={customers}
              activeCustomerId={activeCustomerId}
              onSelectCustomer={setActiveCustomerId}
              onRegisterCustomer={handleRegisterCustomer}
              onUpdateBin={handleUpdateBin}
              onDeleteBin={handleDeleteBin}
              onCreatePickupRequest={handleCreatePickupRequest}
              onNotifyCompany={handleNotifyCompany}
              onUpdateFillLevel={handleUpdateFillLevel}
              onRefresh={syncState}
              onAddBin={handleAddBin}
              onProcessPayment={handleProcessPayment}
              onScheduleAIPickup={handleScheduleAIPickup}
            />
          ) : (
            <AdminPortal
              bins={bins}
              pickups={pickups}
              drivers={drivers}
              payments={payments}
              customers={customers}
              onRegisterDriver={handleRegisterDriver}
              onAssignDriver={handleAssignDriver}
              onDispatchDriver={handleDispatchDriver}
              onRefresh={syncState}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="w-full bg-slate-100 py-8 border-t border-slate-200 mt-auto px-6 md:px-8">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">EcoCycle Services</span>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                We leverage cloud IoT sensors and modern artificial intelligence to minimize waste hauling carbon footprints, optimize route dispatching, and provide simple card settlement.
              </p>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Enterprise Guidelines</span>
              <ul className="space-y-1 text-[11px] text-slate-400 font-medium">
                <li>• Automated sensors alert dispatch at 85% bin fullness</li>
                <li>• Card receipts are stored in the secure transactional ledger</li>
                <li>• Clean recycling material qualifies for eco-discount rates</li>
              </ul>
            </div>

            <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 flex gap-3">
              <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-slate-700 block">PCI DSS Compliance & AI</span>
                <span className="text-[10px] text-slate-400 block mt-0.5 leading-normal">
                  Card authorizations and Gemini waste analytics calculations are handled server-side to guarantee client safety.
                </span>
              </div>
            </div>
          </div>
        </footer>

        {/* Mock Email Toast System */}
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
          <AnimatePresence>
            {notifications.map(notif => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 50, transition: { duration: 0.2 } }}
                className="bg-slate-900 text-slate-100 rounded-xl shadow-2xl border border-slate-700/80 p-4 pointer-events-auto overflow-hidden relative"
              >
                {/* Decorative Accent Header line */}
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-teal-500 to-indigo-500" />
                
                <div className="flex justify-between items-start mb-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-teal-400 uppercase tracking-widest bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800/50">
                    <span className="animate-pulse text-xs">●</span> Mock Email Sent
                  </div>
                  <button
                    onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
                    className="text-slate-400 hover:text-white transition-colors cursor-pointer p-0.5 rounded hover:bg-slate-800"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-400 font-mono text-[10px] uppercase">To:</span>{' '}
                      <span className="text-white font-semibold">{notif.customerName}</span>{' '}
                      <span className="text-slate-400 text-[10px] font-mono">&lt;{notif.to}&gt;</span>
                    </div>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 font-mono text-[10px] uppercase">From:</span>{' '}
                    <span className="text-teal-300 font-semibold">EcoCycle System</span>{' '}
                    <span className="text-slate-400 text-[10px] font-mono">&lt;no-reply@ecocycle.com&gt;</span>
                  </div>
                  <div className="border-t border-slate-800 my-2 pt-2">
                    <span className="font-bold text-teal-400 font-mono text-[10px] uppercase">Subject:</span>{' '}
                    <span className="text-white font-bold block mt-0.5">{notif.subject}</span>
                  </div>
                  <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap">
                    {notif.body}
                  </div>
                </div>

                <div className="mt-2.5 flex justify-between items-center text-[9px] text-slate-500 font-bold">
                  <span>Sent at: {notif.timestamp}</span>
                  <span className="text-teal-400/80 animate-pulse flex items-center gap-1">
                    📧 Live Alert Connected
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

      </div>

    </div>
  );
}
