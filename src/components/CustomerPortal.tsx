import React, { useState, useEffect } from 'react';
import { 
  Trash2, AlertCircle, Calendar, CreditCard, ChevronRight, CheckCircle2, 
  RefreshCw, Send, DollarSign, Clock, Receipt, Play, Scale, Sparkles, 
  User, UserPlus, MapPin, Edit3, Plus, Check, Map, Phone, Mail, HelpCircle, Smartphone, ArrowRight
} from 'lucide-react';
import { Bin, PickupRequest, PaymentTransaction, AIAnalysisResult, Customer, Driver } from '../types';
import AiWasteAnalyzer from './AiWasteAnalyzer';

interface CustomerPortalProps {
  bins: Bin[];
  pickups: PickupRequest[];
  payments: PaymentTransaction[];
  customers: Customer[];
  activeCustomerId: string;
  onSelectCustomer: (id: string) => void;
  onRegisterCustomer: (name: string, email: string, phone: string, address: string, lat: number, lng: number) => Promise<any>;
  onUpdateBin: (binId: string, type: 'General' | 'Recycling' | 'Organic' | 'Hazardous' | 'Electronic', gallons: number, address: string, lat: number, lng: number) => void;
  onDeleteBin: (binId: string) => void;
  onCreatePickupRequest: (binId: string, customerName: string, address: string, lat: number, lng: number, binType: 'General' | 'Recycling' | 'Organic' | 'Hazardous' | 'Electronic', fillLevel: number, agreedSum: number) => void;
  onNotifyCompany: (binId: string) => void;
  onUpdateFillLevel: (binId: string, level: number) => void;
  onRefresh: () => void;
  onAddBin: (type: 'General' | 'Recycling' | 'Organic' | 'Hazardous' | 'Electronic', gallons: number, ownerName: string, address: string, lat: number, lng: number) => void;
  onProcessPayment: (pickupId: string, amount: number, paymentDetails: any) => Promise<boolean>;
  onScheduleAIPickup: (analysis: AIAnalysisResult, customer: Customer) => void;
}

export default function CustomerPortal({
  bins,
  pickups,
  payments,
  customers = [],
  activeCustomerId,
  onSelectCustomer,
  onRegisterCustomer,
  onUpdateBin,
  onDeleteBin,
  onCreatePickupRequest,
  onNotifyCompany,
  onUpdateFillLevel,
  onRefresh,
  onAddBin,
  onProcessPayment,
  onScheduleAIPickup
}: CustomerPortalProps) {
  // General view control states
  const [showAddBin, setShowAddBin] = useState(false);
  const [showRegisterCustomer, setShowRegisterCustomer] = useState(false);
  const [editingBin, setEditingBin] = useState<Bin | null>(null);
  
  // New Bin fields
  const [newBinType, setNewBinType] = useState<'General' | 'Recycling' | 'Organic' | 'Hazardous' | 'Electronic'>('General');
  const [newBinSize, setNewBinSize] = useState<number>(64);
  const [customBinAddress, setCustomBinAddress] = useState('');
  
  // Register Customer Fields
  const [custName, setCustName] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');

  // Manual pickup request modal
  const [manualPickupBin, setManualPickupBin] = useState<Bin | null>(null);

  // Paystack checkout modal fields
  const [selectedPickupForPayment, setSelectedPickupForPayment] = useState<PickupRequest | null>(null);
  const [paystackChannel, setPaystackChannel] = useState<'card' | 'bank' | 'transfer' | 'ussd'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardPin, setCardPin] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [selectedBank, setSelectedBank] = useState('GTBank');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankOtp, setBankOtp] = useState('');
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [transferTimer, setTransferTimer] = useState(599); // 9:59 countdown
  const [transferSuccessChecking, setTransferSuccessChecking] = useState(false);

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  // Active Customer profile object
  const activeCustomer = customers.find(c => c.id === activeCustomerId) || customers[0] || {
    id: 'cust-1',
    name: 'Bonaventure (You)',
    email: 'bonaventureuche006@gmail.com',
    phone: '+234 812 345 6789',
    address: '710 Cherry St, Seattle, WA',
    lat: 47.6042,
    lng: -122.3302
  };

  const binPurchaseOptions = [
    {
      type: 'General' as const,
      size: 32,
      name: 'General Bin',
      price: 32000,
      badge: 'Most Popular',
      description: 'Perfect for mixed household waste and daily city pickups.',
      features: ['GPS tracking', 'Smart fill sensor', 'Weekly collection']
    },
    {
      type: 'Recycling' as const,
      size: 64,
      name: 'Recycling Bin',
      price: 48000,
      badge: 'Smart Eco',
      description: 'Designed for plastics, paper, and reusable materials.',
      features: ['Separate sorting', 'Eco alerts', 'Priority pickup']
    },
    {
      type: 'Organic' as const,
      size: 64,
      name: 'Organic Bin',
      price: 52000,
      badge: 'Garden Ready',
      description: 'Built for compost, kitchen scraps, and green waste.',
      features: ['Odor control', 'Monthly service', 'Fast collection']
    },
    {
      type: 'Electronic' as const,
      size: 96,
      name: 'E-Waste Bin',
      price: 76000,
      badge: 'Safe Handling',
      description: 'For electronics, cables, and safely disposed tech waste.',
      features: ['Certified handling', 'Secure pickup', 'Verification report']
    }
  ];

  const handlePurchaseBin = (type: 'General' | 'Recycling' | 'Organic' | 'Hazardous' | 'Electronic', size: number, price: number) => {
    onAddBin(type, size, activeCustomer.name, activeCustomer.address, activeCustomer.lat, activeCustomer.lng);
    setShowAddBin(false);
  };

  // Live Driver status (en_route) to calculate dynamic tracking distance/ETA
  const [activeDriver, setActiveDriver] = useState<Driver | null>(null);
  const [distanceRemaining, setDistanceRemaining] = useState<number | null>(null);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);

  // Filter components belonging specifically to the active customer
  const customerBins = bins.filter(b => b.ownerName === activeCustomer.name);
  const customerBinIds = customerBins.map(b => b.id);
  const customerPickups = pickups.filter(p => p.customerName === activeCustomer.name || customerBinIds.includes(p.binId));
  const customerPayments = payments.filter(p => p.customerName === activeCustomer.name);

  // Detect and fetch active driver movement for real-time tracking
  useEffect(() => {
    const enRoutePickup = customerPickups.find(p => p.status === 'en_route');
    if (enRoutePickup && enRoutePickup.driverId) {
      // Find associated driver in operation
      fetch('/api/drivers')
        .then(res => res.json())
        .then((drivers: Driver[]) => {
          const drv = drivers.find(d => d.id === enRoutePickup.driverId);
          if (drv && drv.status === 'en_route') {
            setActiveDriver(drv);
            // Haversine/Euclidean distance simulation
            const latDiff = enRoutePickup.lat - drv.currentLat;
            const lngDiff = enRoutePickup.lng - drv.currentLng;
            const rawDist = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff); // Delta mapping
            const km = parseFloat((rawDist * 111).toFixed(3)); // roughly 111km per lat/lng degree
            setDistanceRemaining(km);
            const eta = Math.ceil(km * 95); // 95 seconds per km
            setEtaSeconds(eta > 0 ? eta : 3);
          } else {
            setActiveDriver(null);
            setDistanceRemaining(null);
            setEtaSeconds(null);
          }
        })
        .catch(err => console.error(err));
    } else {
      setActiveDriver(null);
      setDistanceRemaining(null);
      setEtaSeconds(null);
    }
  }, [pickups, bins, customerPickups]);

  // Transfer Timer ticking
  useEffect(() => {
    if (selectedPickupForPayment && paystackChannel === 'transfer' && transferTimer > 0) {
      const interval = setInterval(() => {
        setTransferTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [selectedPickupForPayment, paystackChannel, transferTimer]);

  // Google Sign-In message listener
  useEffect(() => {
    const handleGoogleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return;
      }
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        const { customerId } = event.data;
        if (customerId) {
          onSelectCustomer(customerId);
          onRefresh(); // Refresh list to get the new customer
          setShowRegisterCustomer(false); // Close registration modal
        }
      }
    };
    window.addEventListener('message', handleGoogleMessage);
    return () => window.removeEventListener('message', handleGoogleMessage);
  }, [onSelectCustomer, onRefresh]);

  const handleGoogleSignIn = async () => {
    try {
      const response = await fetch('/api/auth/google/url');
      if (!response.ok) {
        throw new Error('Failed to fetch auth URL');
      }
      const { url } = await response.json();
      
      const authWindow = window.open(
        url,
        'google_oauth_popup',
        'width=500,height=600,top=100,left=100'
      );
      
      if (!authWindow) {
        alert('Please allow popups for this site to sign in with Google.');
      }
    } catch (err) {
      console.error('Google sign-in init failed:', err);
    }
  };

  const handleRegisterCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName || !custEmail) return;

    // Slight coordinate offset around Seattle city center
    const baseLat = 47.6062;
    const baseLng = -122.3321;
    const customLat = baseLat + (Math.random() - 0.5) * 0.03;
    const customLng = baseLng + (Math.random() - 0.5) * 0.03;

    await onRegisterCustomer(custName, custEmail, custPhone, custAddress, customLat, customLng);
    setShowRegisterCustomer(false);
    setCustName('');
    setCustEmail('');
    setCustPhone('');
    setCustAddress('');
  };

  const handleCreateBinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalAddress = customBinAddress || activeCustomer.address;
    onAddBin(newBinType, newBinSize, activeCustomer.name, finalAddress, activeCustomer.lat, activeCustomer.lng);
    setShowAddBin(false);
    setCustomBinAddress('');
  };

  const handleEditBinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBin) return;
    onUpdateBin(editingBin.id, editingBin.type, editingBin.sizeGallons, editingBin.address, editingBin.lat, editingBin.lng);
    setEditingBin(null);
  };

  const handleManualPickupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPickupBin) return;
    
    // Fee calculation logic based on size and type
    const sizeFactor = manualPickupBin.sizeGallons / 32; 
    const typeRates = { General: 22000, Recycling: 12000, Organic: 15000, Hazardous: 55000, Electronic: 35000 };
    const fee = (typeRates[manualPickupBin.type] || 22000) * sizeFactor;

    onCreatePickupRequest(
      manualPickupBin.id,
      activeCustomer.name,
      manualPickupBin.address,
      manualPickupBin.lat,
      manualPickupBin.lng,
      manualPickupBin.type,
      manualPickupBin.fillLevel,
      Number(fee.toFixed(0))
    );
    setManualPickupBin(null);
  };

  const handlePaystackCheckoutSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedPickupForPayment) return;

    setCheckoutLoading(true);
    setCheckoutError(null);

    // Dynamic payload depending on paystack channel
    const paymentDetails = {
      cardNumber: paystackChannel === 'card' ? cardNumber : `BANK-ACC-${bankAccountNumber || 'TRANS'}`,
      expiry: expiry || '12/29',
      cvc: cvc || '333',
      customerName: activeCustomer.name,
      binType: selectedPickupForPayment.binType,
      paymentMethod: paystackChannel
    };

    const success = await onProcessPayment(selectedPickupForPayment.id, selectedPickupForPayment.agreedSum, paymentDetails);

    setCheckoutLoading(false);
    if (success) {
      setCheckoutSuccess(true);
      setTimeout(() => {
        setCheckoutSuccess(false);
        setSelectedPickupForPayment(null);
        setCardNumber('');
        setExpiry('');
        setCvc('');
        setCardPin('');
        setShowPinModal(false);
        setBankAccountNumber('');
        setBankOtp('');
        setShowOtpScreen(false);
        setTransferTimer(599);
      }, 2000);
    } else {
      setCheckoutError('Payment failed. Gateway rejected the secure transaction authorization.');
    }
  };

  const handleVerifyBankTransfer = () => {
    setTransferSuccessChecking(true);
    setTimeout(() => {
      setTransferSuccessChecking(false);
      handlePaystackCheckoutSubmit();
    }, 1500);
  };

  return (
    <div className="space-y-8">
      
      {/* Profiling and Switcher Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-5 bg-white border border-slate-200 rounded-xl gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <User className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wide">Active Account Profile</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <h4 className="text-base font-extrabold text-slate-800">{activeCustomer.name}</h4>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mt-0.5">
              <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {activeCustomer.email}</span>
              <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {activeCustomer.phone}</span>
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {activeCustomer.address}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <select
              value={activeCustomerId}
              onChange={(e) => onSelectCustomer(e.target.value)}
              className="w-full md:w-64 px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.address.split(',')[0]})</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleGoogleSignIn}
            className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.68 1.54 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.85 2.99C6.2 7.15 8.9 5.04 12 5.04z"/>
              <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.73 2.89c2.18-2.01 3.7-4.97 3.7-8.63z"/>
              <path fill="#FBBC05" d="M5.24 14.45c-.25-.76-.39-1.57-.39-2.45s.14-1.69.39-2.45L1.39 6.56C.5 8.2 0 10.04 0 12s.5 3.8 1.39 5.44l3.85-2.99z"/>
              <path fill="#34A853" d="M12 23c3.24 0 5.97-1.08 7.96-2.91l-3.73-2.89c-1.1.74-2.5 1.18-4.23 1.18-3.1 0-5.8-2.11-6.76-5.51l-3.85 2.99C3.37 20.33 7.35 23 12 23z"/>
            </svg>
            <span className="hidden sm:inline text-slate-600">Google Sign In</span>
          </button>
          <button
            onClick={() => setShowRegisterCustomer(true)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Register Profile</span>
          </button>
        </div>
      </div>

      {/* Customer Hero Stats Header */}
      <div className="bg-slate-900 text-white rounded-xl p-6 md:p-8 relative overflow-hidden shadow-md">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute left-1/3 bottom-0 translate-y-16 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest block mb-1">Eco Smart Home Grid</span>
            <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">EcoCycle Asset Manager</h1>
            <p className="text-slate-400 mt-2 text-sm md:text-base max-w-xl">
              Track IoT sensor feeds of your smart bins. When level peaks above 85%, automated alerts notify company dispatch. Alternatively, book on-demand custom pickups.
            </p>
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              onClick={onRefresh}
              className="p-3 bg-white/10 hover:bg-white/15 text-white rounded-xl transition-all cursor-pointer flex items-center gap-2 text-sm font-medium border border-white/5"
            >
              <RefreshCw className="w-4 h-4 animate-spin [animation-duration:12s]" />
              <span>Sync Assets</span>
            </button>
            <button
              onClick={() => setShowAddBin(true)}
              className="py-3 px-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-500/20 text-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-slate-950 stroke-[3]" />
              <span>Configure New IoT Bin</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600">Bin Marketplace</span>
            <h2 className="mt-1 text-xl font-black text-slate-800">Buy a Smart Waste Bin</h2>
          </div>
          <button
            onClick={() => setShowAddBin(true)}
            className="px-3 py-2 text-xs font-bold border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-all"
          >
            Custom Bin Order
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {binPurchaseOptions.map((option) => (
            <div key={option.type} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
                  {option.badge}
                </span>
                <span className="text-[10px] font-semibold text-slate-500">{option.size} gal</span>
              </div>

              <h3 className="text-lg font-black text-slate-800">{option.name}</h3>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">{option.description}</p>

              <div className="mt-4 flex items-end gap-1">
                <span className="text-2xl font-black text-slate-900">₦{option.price.toLocaleString()}</span>
                <span className="text-[10px] text-slate-400 mb-1">one-time</span>
              </div>

              <ul className="mt-4 space-y-2 text-xs text-slate-600">
                {option.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handlePurchaseBin(option.type, option.size, option.price)}
                className="mt-5 w-full py-2.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-700 transition-all"
              >
                Buy this bin
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Register Customer Profile Drawer/Modal */}
      {showRegisterCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-600" />
                <span>Register Customer Profile</span>
              </h3>
              <button onClick={() => setShowRegisterCustomer(false)} className="text-slate-400 hover:text-slate-600 text-sm font-semibold">✕</button>
            </div>
            
            <form onSubmit={handleRegisterCustomerSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Full Customer Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alice Johnson"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. alice@example.com"
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +234 803 111 2222"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Property Street Address (Seattle Grid)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1520 Belmont Ave, Seattle, WA"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                />
              </div>

              <div className="bg-emerald-50 p-3 rounded-lg text-[11px] text-emerald-800 leading-normal flex gap-2">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Geographic GPS coordinates (Latitude/Longitude) on the dynamic Seattle monitoring grid will be programmatically geocoded.</span>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-all cursor-pointer"
              >
                Create Account Profile
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-400 font-bold text-[10px] tracking-wider">Or continue with</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-all cursor-pointer shadow-sm"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.68 1.54 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.85 2.99C6.2 7.15 8.9 5.04 12 5.04z"/>
                  <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.73 2.89c2.18-2.01 3.7-4.97 3.7-8.63z"/>
                  <path fill="#FBBC05" d="M5.24 14.45c-.25-.76-.39-1.57-.39-2.45s.14-1.69.39-2.45L1.39 6.56C.5 8.2 0 10.04 0 12s.5 3.8 1.39 5.44l3.85-2.99z"/>
                  <path fill="#34A853" d="M12 23c3.24 0 5.97-1.08 7.96-2.91l-3.73-2.89c-1.1.74-2.5 1.18-4.23 1.18-3.1 0-5.8-2.11-6.76-5.51l-3.85 2.99C3.37 20.33 7.35 23 12 23z"/>
                </svg>
                <span>Sign Up or Sign In with Google</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Configure/Order Smart Bin Overlay Modal */}
      {showAddBin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-extrabold text-slate-800">Add Smart Bin to Account</h3>
              <button onClick={() => setShowAddBin(false)} className="text-slate-400 hover:text-slate-600 text-sm font-semibold">✕</button>
            </div>
            
            <form onSubmit={handleCreateBinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Waste Classification Type</label>
                <select
                  value={newBinType}
                  onChange={(e) => setNewBinType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                >
                  <option value="General">General Garbage</option>
                  <option value="Recycling">Recycling Materials</option>
                  <option value="Organic">Compost / Organic Scraps</option>
                  <option value="Hazardous">Hazardous / Chemicals</option>
                  <option value="Electronic">Electronic E-Waste</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Bin Volume Size</label>
                <div className="grid grid-cols-3 gap-2">
                  {[32, 64, 96].map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setNewBinSize(size)}
                      className={`py-2 px-3 border rounded-lg text-xs font-semibold transition-all ${
                        newBinSize === size
                          ? 'border-emerald-500 bg-emerald-50/30 text-emerald-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      {size} Gallons
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Custom Bin Installation Address (Optional)</label>
                <input
                  type="text"
                  placeholder={activeCustomer.address}
                  value={customBinAddress}
                  onChange={(e) => setCustomBinAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-lg text-[11px] text-slate-500 leading-relaxed">
                * All IoT smart bins are delivered pre-configured with integrated ultrasonic volumetric level transmitters and cloud-linked telecommunications cards.
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all text-xs"
              >
                Deploy IoT Smart Bin
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Bin Modal */}
      {editingBin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-extrabold text-slate-800">Edit Smart Bin Configuration</h3>
              <button onClick={() => setEditingBin(null)} className="text-slate-400 hover:text-slate-600 text-sm font-semibold">✕</button>
            </div>
            
            <form onSubmit={handleEditBinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Bin Classification</label>
                <select
                  value={editingBin.type}
                  onChange={(e) => setEditingBin({ ...editingBin, type: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                >
                  <option value="General">General Garbage</option>
                  <option value="Recycling">Recycling Materials</option>
                  <option value="Organic">Compost / Organic Scraps</option>
                  <option value="Hazardous">Hazardous / Chemicals</option>
                  <option value="Electronic">Electronic E-Waste</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Capacity (Gallons)</label>
                <div className="grid grid-cols-3 gap-2">
                  {[32, 64, 96].map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setEditingBin({ ...editingBin, sizeGallons: size })}
                      className={`py-2 px-3 border rounded-lg text-xs font-semibold transition-all ${
                        editingBin.sizeGallons === size
                          ? 'border-emerald-500 bg-emerald-50/30 text-emerald-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      {size} Gal
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Hardware Installation Location Address</label>
                <input
                  type="text"
                  required
                  value={editingBin.address}
                  onChange={(e) => setEditingBin({ ...editingBin, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">GPS Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={editingBin.lat}
                    onChange={(e) => setEditingBin({ ...editingBin, lat: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">GPS Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={editingBin.lng}
                    onChange={(e) => setEditingBin({ ...editingBin, lng: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition-all cursor-pointer"
              >
                Save Bin Modifications
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Create Manual Pickup Form Modal */}
      {manualPickupBin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-extrabold text-slate-800">Schedule On-Demand Disposal</h3>
              <button onClick={() => setManualPickupBin(null)} className="text-slate-400 hover:text-slate-600 text-sm font-semibold">✕</button>
            </div>
            
            <form onSubmit={handleManualPickupSubmit} className="space-y-4">
              <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Bin Identification:</span>
                  <span className="font-bold text-slate-800">{manualPickupBin.id}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Type Category:</span>
                  <span className="font-bold text-slate-800">{manualPickupBin.type} Waste</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Capacity Volume:</span>
                  <span className="font-bold text-slate-800">{manualPickupBin.sizeGallons} Gallons</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Current Sensor Level:</span>
                  <span className="font-bold text-slate-800">{manualPickupBin.fillLevel}% Full</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex justify-between items-center">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">Estimated Eco Rate Fee</span>
                  <span className="block text-slate-400 text-[10px]">Auto-scaled by size & type</span>
                </div>
                <span className="text-xl font-black text-emerald-700">
                  ₦{((manualPickupBin.sizeGallons / 32) * (manualPickupBin.type === 'Recycling' ? 12000 : manualPickupBin.type === 'Organic' ? 15000 : manualPickupBin.type === 'Hazardous' ? 55000 : manualPickupBin.type === 'Electronic' ? 35000 : 22000)).toLocaleString()}
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all text-xs cursor-pointer shadow-sm shadow-emerald-200"
              >
                Confirm On-Demand Pickup Request
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Main Grid Layout: Bins (Left) & Real-time Live Tracking + Collections (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Smart Bins with Fill Simulators */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">Your Monitored Smart Bins</h2>
            <span className="text-xs text-slate-400 font-bold uppercase">Simulated IoT Nodes: {customerBins.length}</span>
          </div>

          {customerBins.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
              <p className="text-slate-400 text-xs font-semibold">You do not have any smart bins provisioned under this profile.</p>
              <button
                onClick={() => setShowAddBin(true)}
                className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                Configure First Bin
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customerBins.map(bin => {
                const isFull = bin.fillLevel >= 85;
                const typeColor = 
                  bin.type === 'Recycling' ? 'bg-indigo-600' :
                  bin.type === 'Organic' ? 'bg-emerald-600' :
                  bin.type === 'Hazardous' ? 'bg-rose-600' :
                  bin.type === 'Electronic' ? 'bg-amber-500' : 'bg-slate-700';

                return (
                  <div id={`bin-card-${bin.id}`} key={bin.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-all">
                    {/* Card Header with Edit/Delete icons */}
                    <div className="p-5 border-b border-slate-200 flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-extrabold text-white px-1.5 py-0.5 rounded uppercase ${typeColor}`}>
                            {bin.type}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">ID: {bin.id.split('-').slice(-1)}</span>
                        </div>
                        <h3 className="font-extrabold text-slate-800 mt-1">{bin.sizeGallons}-Gallon Bin</h3>
                        <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5 max-w-[140px]" title={bin.address}>
                          {bin.address}
                        </p>
                      </div>

                      <div className="flex flex-col items-end">
                        <div className="flex gap-1.5 mb-1">
                          <button 
                            onClick={() => setEditingBin(bin)}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-50"
                            title="Edit Bin Details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => onDeleteBin(bin.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-50"
                            title="Unregister Bin"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase leading-none block">Sensor Level</span>
                        <div className={`text-xl font-black leading-tight ${isFull ? 'text-rose-600' : 'text-slate-700'}`}>
                          {bin.fillLevel}%
                        </div>
                      </div>
                    </div>

                    {/* Visual Cylinder Level */}
                    <div className="p-5 bg-slate-50/50 flex items-center justify-between gap-6">
                      <div className="relative w-16 h-24 bg-slate-200 border border-slate-300 rounded-b-xl overflow-hidden flex flex-col justify-end shadow-inner shrink-0">
                        <div
                          className={`w-full transition-all duration-700 ease-out relative ${
                            isFull ? 'bg-rose-500/85' :
                            bin.type === 'Recycling' ? 'bg-indigo-500/80' :
                            bin.type === 'Organic' ? 'bg-emerald-500/80' :
                            bin.type === 'Hazardous' ? 'bg-rose-500/80' : 'bg-slate-500/80'
                          }`}
                          style={{ height: `${bin.fillLevel}%` }}
                        >
                          <div className="absolute inset-0 bg-white/10 animate-pulse" />
                        </div>
                      </div>

                      <div className="flex-1 space-y-3">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Simulate Sensor Fill:</span>
                          <input
                            id={`fill-slider-${bin.id}`}
                            type="range"
                            min="0"
                            max="100"
                            value={bin.fillLevel}
                            onChange={(e) => onUpdateFillLevel(bin.id, Number(e.target.value))}
                            className="w-full accent-emerald-500 cursor-pointer"
                          />
                        </div>

                        <div className="flex justify-between items-center text-[9px] font-bold text-slate-400">
                          <span>Empty</span>
                          <span>Full (85%+)</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer / Immediate custom triggers */}
                    <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-semibold">
                        Sensor Status: {isFull ? '🔴 Alert Sent' : '🟢 Monitored'}
                      </span>

                      {isFull ? (
                        <span className="text-[10px] font-extrabold text-rose-600 flex items-center gap-1 bg-rose-50 px-2 py-1 rounded border border-rose-100">
                          <AlertCircle className="w-3 h-3" /> Full Alert Active
                        </span>
                      ) : (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => onNotifyCompany(bin.id)}
                            className="py-1 px-2.5 bg-slate-100 hover:bg-slate-800 hover:text-white rounded text-[10px] font-bold text-slate-700 transition-all cursor-pointer flex items-center gap-1"
                            title="Trigger simulated alert as if bin reached 85% full"
                          >
                            <Send className="w-2.5 h-2.5" /> Sensor Alert
                          </button>
                          <button
                            onClick={() => setManualPickupBin(bin)}
                            className="py-1 px-2.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 border border-emerald-200"
                            title="Directly request custom pickup"
                          >
                            <Calendar className="w-2.5 h-2.5" /> Book Disposal
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Real-time Live Tracking Status Timeline & Active Requests */}
        <div className="lg:col-span-5 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">Collection & Dispatch Queue</h2>
            <span className="text-xs text-slate-400 font-bold uppercase">Dynamic Dispatch Tracks</span>
          </div>

          {/* Real-time Interactive GPS Status Tracker panel (Renders if there is an active job) */}
          {customerPickups.some(p => p.status !== 'completed' && p.status !== 'cancelled') && (
            <div className="bg-slate-900 text-white rounded-xl border border-slate-950 p-5 shadow-lg space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <Map className="w-20 h-20 text-emerald-400" />
              </div>
              
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest block">Operational Stream</span>
                  <h3 className="text-sm font-extrabold text-white mt-1">Live Disposal Tracker</h3>
                </div>
                {activeDriver && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] text-emerald-400 font-mono">
                    Vehicle: {activeDriver.vehicleNumber} ({activeDriver.vehicleType})
                  </div>
                )}
              </div>

              {/* Dynamic ETA / Distance calculations if en_route */}
              {activeDriver && distanceRemaining !== null && etaSeconds !== null ? (
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700/50 flex justify-between items-center relative z-10">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Estimated Arrival</span>
                    <span className="block text-xl font-black text-emerald-400 animate-pulse">
                      {etaSeconds > 60 ? `${Math.floor(etaSeconds / 60)}m ${etaSeconds % 60}s` : `${etaSeconds} seconds`}
                    </span>
                  </div>

                  <div className="text-right space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Distance Left</span>
                    <span className="block text-xl font-black text-white">
                      {distanceRemaining > 1 ? `${distanceRemaining.toFixed(1)} km` : `${Math.round(distanceRemaining * 1000)} meters`}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-800/40 p-3 rounded-xl text-[11px] text-slate-400 text-center relative z-10">
                  Waiting for operational fleet dispatch to initialize real-time vehicle GPS tracking.
                </div>
              )}

              {/* Dynamic Timeline visualization */}
              <div className="space-y-3 pt-2 relative z-10">
                {customerPickups.filter(p => p.status !== 'completed' && p.status !== 'cancelled').slice(0, 1).map(activeJob => {
                  const isUnpaid = activeJob.paymentStatus !== 'paid';
                  const isScheduled = activeJob.status === 'scheduled';
                  const isEnRoute = activeJob.status === 'en_route';
                  
                  // Progress step indices
                  let activeStep = 0;
                  if (!isUnpaid) activeStep = 1; // Paid / Scheduled
                  if (isEnRoute && distanceRemaining && distanceRemaining > 0.4) activeStep = 2; // Dispatched En route
                  if (isEnRoute && distanceRemaining && distanceRemaining <= 0.4 && distanceRemaining > 0.05) activeStep = 3; // Arriving
                  if (isEnRoute && distanceRemaining && distanceRemaining <= 0.05) activeStep = 4; // Loading

                  const steps = [
                    { label: 'Payment Authenticated', desc: isUnpaid ? 'Waiting secure clearance' : 'Invoice settled via Paystack' },
                    { label: 'Disposal Scheduled', desc: activeJob.driverId ? 'Crew assigned & routing' : 'Queue pending fleet slot' },
                    { label: 'Vehicle Dispatched', desc: activeStep >= 2 ? 'Transit started' : 'At depot queue' },
                    { label: 'Nearing Property', desc: activeStep >= 3 ? 'Within local perimeter' : 'At dispatch depot' },
                    { label: 'Clearing Bin Storage', desc: activeStep >= 4 ? 'Crew loading compactor' : 'Pending local arrival' }
                  ];

                  return (
                    <div key={activeJob.id} className="space-y-3">
                      {/* Interactive Visual GPS Progress Line */}
                      {isEnRoute && (
                        <div className="relative w-full h-1 bg-slate-800 rounded-full my-4">
                          <div 
                            className="absolute top-0 left-0 h-1 bg-emerald-400 transition-all duration-1000 ease-linear rounded-full"
                            style={{ width: `${Math.min(100, Math.max(5, (1 - (distanceRemaining || 0) / 1.5) * 100))}%` }}
                          />
                          <div 
                            className="absolute -top-2 text-base transition-all duration-1000 ease-linear"
                            style={{ 
                              left: `calc(${Math.min(95, Math.max(2, (1 - (distanceRemaining || 0) / 1.5) * 100))}% - 8px)`,
                            }}
                          >
                            🚚
                          </div>
                          <div className="absolute right-0 -top-2 text-xs">🏠</div>
                        </div>
                      )}

                      <div className="relative pl-5 border-l border-slate-800 space-y-4">
                        {steps.map((st, sIdx) => {
                          const isCompletedStep = sIdx < activeStep;
                          const isCurrentStep = sIdx === activeStep;
                          
                          return (
                            <div key={sIdx} className="relative text-xs">
                              {/* Glowing bullet indicator */}
                              <div className={`absolute -left-[25px] top-1 w-2.5 h-2.5 rounded-full border-2 ${
                                isCompletedStep ? 'bg-emerald-400 border-emerald-400 shadow-[0_0_8px_#34d399]' :
                                isCurrentStep ? 'bg-amber-400 border-amber-400 animate-pulse shadow-[0_0_8px_#fbbf24]' :
                                'bg-slate-800 border-slate-700'
                              }`} />

                              <p className={`font-bold ${isCurrentStep ? 'text-amber-400' : isCompletedStep ? 'text-emerald-400' : 'text-slate-500'}`}>
                                {st.label}
                              </p>
                              <p className="text-[10px] text-slate-400 leading-normal mt-0.5">{st.desc}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Core Collection Queue cards */}
          <div className="space-y-4">
            {customerPickups.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm">
                <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-600">No Active Bookings</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Your smart bins are clean. Slide sensor fill sliders or click 'Book Disposal' to schedule a disposal ticket.
                </p>
              </div>
            ) : (
              customerPickups.map(pickup => {
                const isPaid = pickup.paymentStatus === 'paid';
                const statusLabels = {
                  pending: { text: 'Awaiting Payment', style: 'bg-amber-50 text-amber-700 border-amber-100' },
                  scheduled: { text: 'Truck Scheduled', style: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
                  en_route: { text: 'Truck En Route', style: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                  completed: { text: 'Completed', style: 'bg-slate-100 text-slate-700 border-slate-200' },
                  cancelled: { text: 'Cancelled', style: 'bg-rose-50 text-rose-700 border-rose-100' }
                };
                const label = statusLabels[pickup.status] || { text: pickup.status, style: 'bg-slate-50' };

                return (
                  <div id={`pickup-card-${pickup.id}`} key={pickup.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded border uppercase ${label.style}`}>
                          {label.text}
                        </span>
                        <h4 className="font-extrabold text-slate-800 mt-2">{pickup.binType} Disposal</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5 font-medium truncate max-w-[200px]">{pickup.address}</p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Fee Due</span>
                        <span className="text-lg font-black text-slate-800">₦{pickup.agreedSum.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 space-y-1.5 font-medium border border-slate-100">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400 font-bold">Request ID:</span>
                        <span className="font-mono">{pickup.id}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400 font-bold">Logged:</span>
                        <span>{new Date(pickup.requestedAt).toLocaleTimeString()} {new Date(pickup.requestedAt).toLocaleDateString()}</span>
                      </div>
                      {pickup.scheduledFor && (
                        <div className="flex justify-between text-[11px] text-indigo-600">
                          <span className="font-bold">Scheduled Time Slot:</span>
                          <span className="font-extrabold">{new Date(pickup.scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      )}
                    </div>

                    {pickup.status === 'pending' && pickup.paymentStatus === 'unpaid' && (
                      <button
                        id={`pay-now-btn-${pickup.id}`}
                        onClick={() => {
                          setSelectedPickupForPayment(pickup);
                          setPaystackChannel('card');
                          setCheckoutError(null);
                        }}
                        className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-emerald-200"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Authorize Paystack Payment</span>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Paystack Payment Checkout Pop-up Modal */}
      {selectedPickupForPayment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#fcfcfc] rounded-xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col md:flex-row h-[520px]">
            
            {/* Left Channel Sidebar (Paystack Style) */}
            <div className="w-full md:w-56 bg-slate-50 border-r border-slate-200 p-5 flex flex-col justify-between shrink-0">
              <div className="space-y-4">
                <div className="pb-3 border-b border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-ping"></div>
                    <span className="text-[14px] font-black tracking-tight text-teal-800">paystack</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 block mt-1 uppercase tracking-wider">ECOCYCLE SETTLEMENT</span>
                </div>

                <div className="space-y-1">
                  <button 
                    type="button"
                    onClick={() => { setPaystackChannel('card'); setCheckoutError(null); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer text-left ${paystackChannel === 'card' ? 'bg-teal-50 text-teal-700 border border-teal-100' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    <CreditCard className="w-4 h-4 shrink-0" />
                    <span>Pay with Card</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setPaystackChannel('bank'); setCheckoutError(null); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer text-left ${paystackChannel === 'bank' ? 'bg-teal-50 text-teal-700 border border-teal-100' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    <Smartphone className="w-4 h-4 shrink-0" />
                    <span>Pay with Bank</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setPaystackChannel('transfer'); setCheckoutError(null); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer text-left ${paystackChannel === 'transfer' ? 'bg-teal-50 text-teal-700 border border-teal-100' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    <RefreshCw className="w-4 h-4 shrink-0" />
                    <span>Bank Transfer</span>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200/60">
                <span className="text-[10px] text-slate-400 leading-normal block">
                  🔒 Secured by Paystack gateway servers. Local and overseas clearing supported.
                </span>
              </div>
            </div>

            {/* Right Stage Panel */}
            <div className="flex-1 flex flex-col justify-between p-6 overflow-y-auto">
              {/* Header Info */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase leading-none">Checkout Amount</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black text-slate-800">₦{selectedPickupForPayment.agreedSum.toLocaleString()}</span>
                    <span className="text-xs text-slate-400 font-semibold font-mono">NGN</span>
                  </div>
                  <span className="text-[10px] text-teal-600 font-extrabold block mt-0.5 font-mono">Secure: {activeCustomer.email}</span>
                </div>
                <button
                  onClick={() => setSelectedPickupForPayment(null)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600"
                >
                  ✕
                </button>
              </div>

              {/* Success Screen */}
              {checkoutSuccess ? (
                <div className="flex-1 flex flex-col items-center justify-center py-8 space-y-3">
                  <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center scale-110 shadow-inner animate-bounce">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h4 className="text-base font-extrabold text-slate-800">Secure Payment Succeeded</h4>
                  <p className="text-slate-400 text-xs text-center max-w-xs leading-normal">
                    We verified your credentials and authorized {paystackChannel === 'card' ? 'your card payment' : paystackChannel === 'bank' ? 'your bank debit' : 'your transfer verification'}. The system dispatch engine scheduled an automated compactor vehicle immediately!
                  </p>
                </div>
              ) : (
                <div className="flex-1 py-4 flex flex-col justify-between">
                  {/* Channel: Credit/Debit Card Form */}
                  {paystackChannel === 'card' && (
                    <form onSubmit={(e) => { e.preventDefault(); setShowPinModal(true); }} className="space-y-4">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">ATM Credit Card Number</label>
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="4012 8821 0041 8112"
                              value={cardNumber}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 16);
                                const formatted = val.replace(/(.{4})/g, '$1 ').trim();
                                setCardNumber(formatted);
                              }}
                              className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                              required
                            />
                            <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Card Expiry</label>
                            <input
                              type="text"
                              placeholder="MM/YY"
                              value={expiry}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                const formatted = val.length > 2 ? `${val.slice(0, 2)}/${val.slice(2)}` : val;
                                setExpiry(formatted);
                              }}
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">CVV Code</label>
                            <input
                              type="password"
                              placeholder="•••"
                              value={cvc}
                              onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 3))}
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                              required
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-teal-500/10"
                      >
                        <span>Submit Card Information</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  )}

                  {/* Channel: Bank Account OTP form */}
                  {paystackChannel === 'bank' && (
                    <div className="space-y-4">
                      {!showOtpScreen ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Select Bank</label>
                            <select
                              value={selectedBank}
                              onChange={(e) => setSelectedBank(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none"
                            >
                              <option value="GTBank">Guaranty Trust Bank</option>
                              <option value="Zenith">Zenith Bank</option>
                              <option value="Access">Access Bank</option>
                              <option value="Sterling">Sterling Bank</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">NUBAN Account Number</label>
                            <input
                              type="text"
                              placeholder="0122394850"
                              value={bankAccountNumber}
                              onChange={(e) => setBankAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                          </div>

                          <button
                            onClick={() => {
                              if (bankAccountNumber.length === 10) {
                                setShowOtpScreen(true);
                              } else {
                                setCheckoutError('Please enter a valid 10-digit account number.');
                              }
                            }}
                            className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg text-xs cursor-pointer transition-all"
                          >
                            Authenticate Bank Account
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="bg-teal-50 p-3 rounded-lg text-[10px] text-teal-800 leading-normal">
                            An authentication code has been transmitted to the mobile phone registered to account number {bankAccountNumber}.
                          </div>

                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Enter OTP Authorization Code</label>
                            <input
                              type="text"
                              placeholder="123456"
                              value={bankOtp}
                              onChange={(e) => setBankOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold tracking-widest text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                          </div>

                          <button
                            onClick={handlePaystackCheckoutSubmit}
                            className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg text-xs cursor-pointer transition-all"
                          >
                            Verify & Conclude Settlement
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Channel: Bank Transfer with Simulated check */}
                  {paystackChannel === 'transfer' && (
                    <div className="space-y-3">
                      <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg text-[10px] text-amber-800 leading-normal">
                        Transfer the exact amount to the temporary bank account below. The gateway automatically polls for incoming ledger matches.
                      </div>

                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Beneficiary Bank:</span>
                          <span className="font-extrabold text-slate-800">Wema Bank (Paystack Inline)</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Account Number:</span>
                          <span className="font-extrabold text-teal-700 tracking-wider">9940251567</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Beneficiary Name:</span>
                          <span className="font-bold text-slate-800">EcoCycle Operations Ltd</span>
                        </div>
                      </div>

                      <div className="text-center py-2">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Account Expires In</span>
                        <span className="text-sm font-bold text-rose-600 font-mono">
                          {Math.floor(transferTimer / 60)}:{(transferTimer % 60).toString().padStart(2, '0')}
                        </span>
                      </div>

                      <button
                        onClick={handleVerifyBankTransfer}
                        disabled={transferSuccessChecking}
                        className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg text-xs cursor-pointer transition-all flex items-center justify-center gap-1.5"
                      >
                        {transferSuccessChecking ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Polling Interbank Gateway...</span>
                          </>
                        ) : (
                          <span>I've sent the money</span>
                        )}
                      </button>
                    </div>
                  )}

                  {checkoutError && (
                    <div className="mt-3 flex items-center gap-1.5 p-3 bg-rose-50 text-rose-700 rounded-lg text-[10px] leading-normal font-semibold">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>{checkoutError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Credit Card Secure PIN Modal overlay if card channel submitted */}
      {showPinModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-xs w-full p-5 space-y-4 text-center">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Enter Card Auth PIN</h3>
            <p className="text-[10px] text-slate-400 leading-normal">Enter your 4-digit bank card secure authorization PIN to clear the transaction.</p>
            
            <input
              type="password"
              placeholder="••••"
              value={cardPin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                setCardPin(val);
                if (val.length === 4) {
                  setShowPinModal(false);
                  handlePaystackCheckoutSubmit();
                }
              }}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-center tracking-widest text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowPinModal(false)} className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold text-slate-600">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* AI Analyser Subsection */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">Special Material & AI Disposal Quote</h2>
          <span className="text-xs text-slate-400 font-bold uppercase">Instant Eco Consulting</span>
        </div>
        <AiWasteAnalyzer 
          onQuoteAccepted={(analysis) => onScheduleAIPickup(analysis, activeCustomer)} 
          customerAddress={activeCustomer.address} 
        />
      </div>

      {/* Payment Ledger / Billing History */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="w-5 h-5 text-slate-500" />
          <h2 className="text-lg font-bold text-slate-800">Settled Transactions & Invoices</h2>
        </div>

        {customerPayments.length === 0 ? (
          <p className="text-slate-400 text-xs font-semibold">No transactions recorded yet for this active profile.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                  <th className="p-3">Transaction ID</th>
                  <th className="p-3">Material Category</th>
                  <th className="p-3">Payment Date</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Source reference</th>
                  <th className="p-3 text-right">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="text-xs text-slate-600 font-medium">
                {customerPayments.map(tx => (
                  <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="p-3 font-mono">{tx.id}</td>
                    <td className="p-3">{tx.binType} Waste</td>
                    <td className="p-3">
                      {new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                        {tx.paymentMethod || 'card'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 font-mono">
                      {tx.paymentMethod === 'card' ? `•••• ${tx.cardLast4 || '4242'}` : tx.cardLast4}
                    </td>
                    <td className="p-3 text-right font-black text-emerald-600">₦{tx.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
