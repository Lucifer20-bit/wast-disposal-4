import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { Bin, PickupRequest, Driver, PaymentTransaction, AIAnalysisResult, Customer } from "./src/types";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

// Initialize Gemini Client safely
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (apiKey) {
  aiClient = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Global Server-Side Database Mock
let customers: Customer[] = [
  { id: 'cust-1', name: 'Bonaventure (You)', email: 'bonaventureuche006@gmail.com', phone: '+234 812 345 6789', address: '710 Cherry St, Seattle, WA', lat: 47.6042, lng: -122.3302 },
  { id: 'cust-2', name: 'Liam O\'Connor', email: 'liam.oconnor@gmail.com', phone: '+1 (206) 555-0143', address: '1420 Pike Place, Seattle, WA', lat: 47.6088, lng: -122.3411 },
  { id: 'cust-3', name: 'Aisha Rahman', email: 'aisha.r@outlook.com', phone: '+1 (206) 555-0198', address: '1105 East Pike St, Seattle, WA', lat: 47.6139, lng: -122.3181 },
  { id: 'cust-4', name: 'Sophia Martinez', email: 'sophia.m@gmail.com', phone: '+1 (206) 555-0122', address: '2201 Westlake Ave, Seattle, WA', lat: 47.6174, lng: -122.3382 }
];

let bins: Bin[] = [
  { id: 'bin-101', ownerName: 'Liam O\'Connor', address: '1420 Pike Place, Seattle, WA', lat: 47.6088, lng: -122.3411, type: 'Recycling', sizeGallons: 96, fillLevel: 45, isFullNotificationSent: false, lastUpdated: new Date().toISOString() },
  { id: 'bin-102', ownerName: 'Aisha Rahman', address: '1105 East Pike St, Seattle, WA', lat: 47.6139, lng: -122.3181, type: 'General', sizeGallons: 64, fillLevel: 88, isFullNotificationSent: true, lastUpdated: new Date().toISOString() },
  { id: 'bin-103', ownerName: 'Chen Wei', address: '500 Mercer St, Seattle, WA', lat: 47.6245, lng: -122.3491, type: 'Organic', sizeGallons: 64, fillLevel: 30, isFullNotificationSent: false, lastUpdated: new Date().toISOString() },
  { id: 'bin-104', ownerName: 'Bonaventure (You)', address: '710 Cherry St, Seattle, WA', lat: 47.6042, lng: -122.3302, type: 'General', sizeGallons: 96, fillLevel: 95, isFullNotificationSent: true, lastUpdated: new Date().toISOString() },
  { id: 'bin-105', ownerName: 'Bonaventure (You)', address: '710 Cherry St, Seattle, WA', lat: 47.6042, lng: -122.3302, type: 'Recycling', sizeGallons: 96, fillLevel: 25, isFullNotificationSent: false, lastUpdated: new Date().toISOString() },
  { id: 'bin-106', ownerName: 'Sophia Martinez', address: '2201 Westlake Ave, Seattle, WA', lat: 47.6174, lng: -122.3382, type: 'Hazardous', sizeGallons: 32, fillLevel: 15, isFullNotificationSent: false, lastUpdated: new Date().toISOString() },
];

let pickups: PickupRequest[] = [
  {
    id: 'req-301',
    binId: 'bin-102',
    customerName: 'Aisha Rahman',
    address: '1105 East Pike St, Seattle, WA',
    lat: 47.6139,
    lng: -122.3181,
    binType: 'General',
    fillLevel: 88,
    status: 'scheduled',
    agreedSum: 36750,
    paymentStatus: 'paid',
    paymentId: 'pay-tx-201',
    requestedAt: new Date(Date.now() - 3600000 * 3).toISOString(), // 3 hours ago
    scheduledFor: new Date(Date.now() + 1800000).toISOString(), // in 30 mins
    driverId: 'driver-1'
  },
  {
    id: 'req-302',
    binId: 'bin-104',
    customerName: 'Bonaventure (You)',
    address: '710 Cherry St, Seattle, WA',
    lat: 47.6042,
    lng: -122.3302,
    binType: 'General',
    fillLevel: 95,
    status: 'pending',
    agreedSum: 52500,
    paymentStatus: 'unpaid',
    requestedAt: new Date(Date.now() - 1200000).toISOString() // 20 mins ago
  }
];

let drivers: Driver[] = [
  { id: 'driver-1', name: 'Marcus Vance', status: 'en_route', vehicleNumber: 'TRUCK-901', vehicleType: 'Heavy Compactor', vehicleCapacityKg: 2000, currentLat: 47.6022, currentLng: -122.3422, targetLat: 47.6139, targetLng: -122.3181 },
  { id: 'driver-2', name: 'Dave Miller', status: 'idle', vehicleNumber: 'TRUCK-405', vehicleType: 'Electric Loader', vehicleCapacityKg: 1200, currentLat: 47.6150, currentLng: -122.3300 }
];

let payments: PaymentTransaction[] = [
  { id: 'pay-tx-201', amount: 36750, status: 'succeeded', customerName: 'Aisha Rahman', binType: 'General', date: new Date(Date.now() - 3600000 * 3).toISOString(), cardLast4: '8811', paymentMethod: 'card' }
];

// Real-Time Backend Simulation Loop
// Simulates truck movement and slow bin filling
setInterval(() => {
  drivers.forEach(driver => {
    if (driver.status === 'en_route' && driver.targetLat && driver.targetLng) {
      const dLat = driver.targetLat - driver.currentLat;
      const dLng = driver.targetLng - driver.currentLng;
      const distance = Math.sqrt(dLat * dLat + dLng * dLng);

      if (distance < 0.0006) {
        // Driver has arrived!
        driver.currentLat = driver.targetLat;
        driver.currentLng = driver.targetLng;
        driver.status = 'idle';
        delete driver.targetLat;
        delete driver.targetLng;

        // Complete the associated pickup
        const activePickup = pickups.find(p => p.driverId === driver.id && p.status === 'en_route');
        if (activePickup) {
          activePickup.status = 'completed';
          activePickup.completedAt = new Date().toISOString();
          
          // Reset the bin that was collected
          const bin = bins.find(b => b.id === activePickup.binId);
          if (bin) {
            bin.fillLevel = 0;
            bin.isFullNotificationSent = false;
            bin.lastUpdated = new Date().toISOString();
          }
        }
      } else {
        // Truck moves dynamically towards pickup coordinates
        const speedFactor = 0.00018; // approx 15m/tick
        driver.currentLat += (dLat / distance) * speedFactor;
        driver.currentLng += (dLng / distance) * speedFactor;
      }
    }
  });

  // Bins slowly fill up
  bins.forEach(bin => {
    if (bin.fillLevel < 100) {
      bin.fillLevel = Math.min(100, parseFloat((bin.fillLevel + Math.random() * 0.15).toFixed(1)));
      if (bin.fillLevel >= 85 && !bin.isFullNotificationSent) {
        bin.isFullNotificationSent = true;
        bin.lastUpdated = new Date().toISOString();
      }
    }
  });
}, 4000);

// API Endpoints
// Bins
app.get("/api/bins", (req, res) => {
  res.json(bins);
});

app.post("/api/bins", (req, res) => {
  const { ownerName, address, type, sizeGallons, lat, lng } = req.body;
  const newBin: Bin = {
    id: `bin-${Date.now()}`,
    ownerName: ownerName || "Guest Customer",
    address: address || "710 Cherry St, Seattle, WA",
    lat: lat || 47.6042,
    lng: lng || -122.3302,
    type: type || "General",
    sizeGallons: Number(sizeGallons) || 64,
    fillLevel: 0,
    isFullNotificationSent: false,
    lastUpdated: new Date().toISOString()
  };
  bins.push(newBin);
  res.status(201).json(newBin);
});

app.put("/api/bins/:id", (req, res) => {
  const bin = bins.find(b => b.id === req.params.id);
  if (!bin) return res.status(404).json({ error: "Bin not found" });

  const { type, sizeGallons, address, lat, lng } = req.body;
  if (type) bin.type = type;
  if (sizeGallons) bin.sizeGallons = Number(sizeGallons);
  if (address) bin.address = address;
  if (lat !== undefined) bin.lat = Number(lat);
  if (lng !== undefined) bin.lng = Number(lng);
  bin.lastUpdated = new Date().toISOString();

  res.json(bin);
});

app.delete("/api/bins/:id", (req, res) => {
  const index = bins.findIndex(b => b.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Bin not found" });

  bins.splice(index, 1);
  res.json({ success: true });
});

app.post("/api/bins/:id/fill", (req, res) => {
  const { fillLevel } = req.body;
  const bin = bins.find(b => b.id === req.params.id);
  if (!bin) return res.status(404).json({ error: "Bin not found" });

  bin.fillLevel = Math.max(0, Math.min(100, Number(fillLevel)));
  if (bin.fillLevel >= 85) {
    bin.isFullNotificationSent = true;
  } else {
    bin.isFullNotificationSent = false;
  }
  bin.lastUpdated = new Date().toISOString();
  res.json(bin);
});

app.post("/api/bins/:id/notify", (req, res) => {
  const bin = bins.find(b => b.id === req.params.id);
  if (!bin) return res.status(404).json({ error: "Bin not found" });

  bin.isFullNotificationSent = true;
  bin.lastUpdated = new Date().toISOString();

  // Create or retrieve pending request
  let existingReq = pickups.find(p => p.binId === bin.id && p.status !== 'completed' && p.status !== 'cancelled');
  if (!existingReq) {
    // Generate a default charge based on bin size and type
    const sizeFactor = bin.sizeGallons / 32; // 1, 2, or 3
    const typeRates = { General: 22000, Recycling: 12000, Organic: 15000, Hazardous: 55000, Electronic: 35000 };
    const fee = (typeRates[bin.type] || 22000) * sizeFactor;

    existingReq = {
      id: `req-${Date.now()}`,
      binId: bin.id,
      customerName: bin.ownerName,
      address: bin.address,
      lat: bin.lat,
      lng: bin.lng,
      binType: bin.type,
      fillLevel: bin.fillLevel,
      status: 'pending',
      agreedSum: Number(fee.toFixed(0)),
      paymentStatus: 'unpaid',
      requestedAt: new Date().toISOString()
    };
    pickups.push(existingReq);
  }

  res.json({ bin, request: existingReq });
});

// Pickups
app.get("/api/pickups", (req, res) => {
  res.json(pickups);
});

app.post("/api/pickups", (req, res) => {
  const { binId, customerName, address, lat, lng, binType, fillLevel, agreedSum } = req.body;
  
  const newPickup: PickupRequest = {
    id: `req-${Date.now()}`,
    binId: binId || `manual-${Date.now()}`,
    customerName: customerName || "Customer",
    address: address || "710 Cherry St, Seattle, WA",
    lat: lat || 47.6042,
    lng: lng || -122.3302,
    binType: binType || "General",
    fillLevel: fillLevel || 90,
    status: 'pending',
    agreedSum: Number(agreedSum) || 25000,
    paymentStatus: 'unpaid',
    requestedAt: new Date().toISOString()
  };

  pickups.push(newPickup);
  res.status(201).json(newPickup);
});

app.put("/api/pickups/:id/status", (req, res) => {
  const { status, driverId, scheduledFor } = req.body;
  const pickup = pickups.find(p => p.id === req.params.id);
  if (!pickup) return res.status(404).json({ error: "Pickup request not found" });

  if (status) pickup.status = status;
  if (driverId !== undefined) {
    pickup.driverId = driverId;
    const driver = drivers.find(d => d.id === driverId);
    if (driver && status === 'en_route') {
      driver.status = 'en_route';
      driver.targetLat = pickup.lat;
      driver.targetLng = pickup.lng;
    }
  }
  if (scheduledFor) pickup.scheduledFor = scheduledFor;

  res.json(pickup);
});

// Customers
app.get("/api/customers", (req, res) => {
  res.json(customers);
});

app.post("/api/customers", (req, res) => {
  const { name, email, phone, address, lat, lng } = req.body;
  const newCustomer: Customer = {
    id: `cust-${Date.now()}`,
    name: name || "Anonymous User",
    email: email || "customer@example.com",
    phone: phone || "+1 206-555-0199",
    address: address || "Seattle, WA",
    lat: Number(lat) || 47.6062,
    lng: Number(lng) || -122.3321
  };
  customers.push(newCustomer);
  res.status(201).json(newCustomer);
});

// Google Sign-In & Registration OAuth Endpoints
app.get("/api/auth/google/url", (req, res) => {
  const isSandbox = !process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${process.env.APP_URL || (req.protocol + '://' + req.get('host'))}/auth/google/callback`;
  
  if (isSandbox) {
    // Return sandbox login path
    res.json({
      url: `/auth/google/sandbox-login`,
      isSandbox: true
    });
  } else {
    // Real Google OAuth authorization URL
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "consent"
    });
    res.json({
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      isSandbox: false
    });
  }
});

// Beautiful Google Account Choose Page for Sandbox Mode
app.get("/auth/google/sandbox-login", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sign in with Google - Sandbox Mode</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Roboto', sans-serif; }
      </style>
    </head>
    <body class="bg-[#f0f4f9] flex items-center justify-center min-h-screen p-4">
      <div class="bg-white rounded-3xl shadow-sm border border-[#e0e3e7] w-full max-w-[450px] p-10 flex flex-col justify-between min-h-[500px]">
        <div>
          <!-- Google Logo -->
          <div class="flex items-center gap-1.5 mb-6">
            <svg class="w-10 h-10" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.68 1.54 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.85 2.99C6.2 7.15 8.9 5.04 12 5.04z"/>
              <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.73 2.89c2.18-2.01 3.7-4.97 3.7-8.63z"/>
              <path fill="#FBBC05" d="M5.24 14.45c-.25-.76-.39-1.57-.39-2.45s.14-1.69.39-2.45L1.39 6.56C.5 8.2 0 10.04 0 12s.5 3.8 1.39 5.44l3.85-2.99z"/>
              <path fill="#34A853" d="M12 23c3.24 0 5.97-1.08 7.96-2.91l-3.73-2.89c-1.1.74-2.5 1.18-4.23 1.18-3.1 0-5.8-2.11-6.76-5.51l-3.85 2.99C3.37 20.33 7.35 23 12 23z"/>
            </svg>
            <span class="font-medium text-lg text-slate-800">EcoCycle Auth Sandbox</span>
          </div>

          <h1 class="text-2xl font-normal text-[#1f1f1f] tracking-tight mb-2">Choose an account</h1>
          <p class="text-[14px] text-[#444746] mb-6">to continue to <span class="font-medium text-slate-700">EcoCycle Pro</span></p>

          <div class="space-y-1">
            <!-- Account 1 -->
            <button onclick="selectAccount('Sarah Jenkins', 'sarah.jenkins@gmail.com')" class="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 border-b border-[#e0e3e7] text-left transition-colors">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-[#1aa260] text-white flex items-center justify-center font-medium text-sm">S</div>
                <div>
                  <div class="text-[14px] font-medium text-[#1f1f1f]">Sarah Jenkins</div>
                  <div class="text-[12px] text-[#444746]">sarah.jenkins@gmail.com</div>
                </div>
              </div>
              <span class="text-[11px] font-medium bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Eco Member</span>
            </button>

            <!-- Account 2 -->
            <button onclick="selectAccount('Marcus Vance', 'marcus.vance@gmail.com')" class="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 border-b border-[#e0e3e7] text-left transition-colors">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-[#1a73e8] text-white flex items-center justify-center font-medium text-sm">M</div>
                <div>
                  <div class="text-[14px] font-medium text-[#1f1f1f]">Marcus Vance</div>
                  <div class="text-[12px] text-[#444746]">marcus.vance@gmail.com</div>
                </div>
              </div>
              <span class="text-[11px] font-medium bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">Eco Crew</span>
            </button>

            <!-- Custom Form Toggle -->
            <button onclick="toggleCustomForm()" class="w-full flex items-center gap-3 p-3.5 hover:bg-slate-50 text-left transition-colors text-slate-600">
              <div class="w-8 h-8 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                +
              </div>
              <div class="text-[14px] font-medium">Use another email...</div>
            </button>
          </div>

          <!-- Custom Account Form (Initially Hidden) -->
          <div id="custom-form" class="hidden mt-4 p-4 border border-[#e0e3e7] rounded-2xl bg-slate-50 space-y-3.5">
            <div>
              <label class="block text-xs font-semibold text-slate-500 mb-1">Full Name</label>
              <input id="custom-name" type="text" placeholder="e.g. David Webb" class="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-500 mb-1">Email Address</label>
              <input id="custom-email" type="email" placeholder="e.g. david@gmail.com" class="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
            </div>
            <button onclick="submitCustom()" class="w-full py-1.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-medium rounded-lg transition-colors">
              Sign in with Custom Account
            </button>
          </div>
        </div>

        <div class="mt-8">
          <p class="text-[11px] text-[#444746] leading-relaxed">
            To create a real Google Client ID, configure <code class="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px]">GOOGLE_CLIENT_ID</code> and <code class="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px]">GOOGLE_CLIENT_SECRET</code> in your project variables.
          </p>
        </div>
      </div>

      <script>
        function selectAccount(name, email) {
          window.location.href = '/auth/google/callback?code=sandbox-code&mock_name=' + encodeURIComponent(name) + '&mock_email=' + encodeURIComponent(email);
        }
        function toggleCustomForm() {
          const form = document.getElementById('custom-form');
          form.classList.toggle('hidden');
        }
        function submitCustom() {
          const name = document.getElementById('custom-name').value;
          const email = document.getElementById('custom-email').value;
          if (!name || !email) {
            alert('Please fill out both name and email');
            return;
          }
          selectAccount(name, email);
        }
      </script>
    </body>
    </html>
  `);
});

// Unified Callback Endpoint for real and sandbox authentication
app.get(['/auth/google/callback', '/auth/google/callback/'], async (req, res) => {
  const { code, mock_name, mock_email } = req.query;

  let email = "sandbox.user@gmail.com";
  let name = "Sandbox Google User";

  const isRealOAuth = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && code && code !== 'sandbox-code');

  if (isRealOAuth) {
    try {
      const redirectUri = `${process.env.APP_URL || (req.protocol + '://' + req.get('host'))}/auth/google/callback`;
      // Exchange Google auth code for token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: code as string,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        })
      });

      if (tokenResponse.ok) {
        const tokens = await tokenResponse.json();
        // Fetch user information with access token
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokens.access_token}` }
        });
        if (userInfoResponse.ok) {
          const userInfo = await userInfoResponse.json();
          email = userInfo.email || email;
          name = userInfo.name || name;
        }
      }
    } catch (err) {
      console.error("Google token exchange error:", err);
    }
  } else {
    // Sandbox mode parses the mock queries
    if (mock_email) {
      email = mock_email as string;
      name = (mock_name as string) || "Sandbox Google User";
    }
  }

  // Handle customer registration/lookup inside our state
  let customer = customers.find(c => c.email.toLowerCase() === email.toLowerCase());
  if (!customer) {
    const id = `cust-${Date.now()}`;
    customer = {
      id,
      name,
      email,
      phone: '+1 (206) 555-' + Math.floor(1000 + Math.random() * 9000),
      address: '710 Cherry St, Seattle, WA', // Default address
      lat: 47.6042 + (Math.random() - 0.5) * 0.01,
      lng: -122.3302 + (Math.random() - 0.5) * 0.01
    };
    customers.push(customer);
  }

  // Send communication message and close popup
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Successfully Authenticated</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-[#f0f4f9] flex items-center justify-center min-h-screen">
      <div class="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center max-w-sm space-y-4">
        <div class="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto text-xl font-bold">
          ✓
        </div>
        <div>
          <h2 class="text-base font-bold text-slate-800">Authentication Successful!</h2>
          <p class="text-xs text-slate-500 mt-1">Logged in as <span class="font-semibold text-slate-700">\${name}</span></p>
        </div>
        <p class="text-[10px] text-slate-400">This popup window will close automatically.</p>
      </div>
      <script>
        if (window.opener) {
          window.opener.postMessage({ 
            type: 'GOOGLE_AUTH_SUCCESS', 
            customerId: \${JSON.stringify(customer.id)},
            customer: \${JSON.stringify(customer)}
          }, '*');
          setTimeout(() => {
            window.close();
          }, 1500);
        } else {
          window.location.href = '/';
        }
      </script>
    </body>
    </html>
  `);
});

// Drivers
app.get("/api/drivers", (req, res) => {
  res.json(drivers);
});

app.post("/api/drivers", (req, res) => {
  const { name, vehicleNumber, vehicleType, vehicleCapacityKg, currentLat, currentLng } = req.body;
  const newDriver: Driver = {
    id: `driver-${Date.now()}`,
    name: name || "New Crew Member",
    status: 'idle',
    vehicleNumber: vehicleNumber || "TRUCK-NEW",
    vehicleType: vehicleType || "General Hauler",
    vehicleCapacityKg: Number(vehicleCapacityKg) || 1500,
    currentLat: Number(currentLat) || 47.6062,
    currentLng: Number(currentLng) || -122.3321
  };
  drivers.push(newDriver);
  res.status(201).json(newDriver);
});

// Payments
app.get("/api/payments", (req, res) => {
  res.json(payments);
});

app.post("/api/payments/checkout", (req, res) => {
  const { pickupId, amount, customerName, binType, cardNumber, expiry, cvc, paymentMethod } = req.body;
  
  // Real payment simulation logic (for non-card, card details can be empty)
  const method = paymentMethod || 'card';
  let cardLast4 = '4242';
  if (method === 'card') {
    if (!cardNumber || cardNumber.length < 15) {
      return res.status(400).json({ error: "Invalid credit card number" });
    }
    cardLast4 = cardNumber.slice(-4);
  }

  const pickup = pickups.find(p => p.id === pickupId);
  const txId = `pay-tx-${Date.now()}`;
  
  const newTx: PaymentTransaction = {
    id: txId,
    amount: Number(amount) || 25.00,
    status: 'succeeded',
    customerName: customerName || "Valued Customer",
    binType: binType || "General",
    date: new Date().toISOString(),
    cardLast4: cardLast4,
    paymentMethod: method
  };

  payments.unshift(newTx); // latest first

  if (pickup) {
    pickup.paymentStatus = 'paid';
    pickup.paymentId = txId;
    // Auto schedule it if paid
    pickup.status = 'scheduled';
    pickup.scheduledFor = new Date(Date.now() + 3600000 * 24).toISOString(); // schedule for tomorrow
    // Auto-assign an idle driver if available
    const idleDriver = drivers.find(d => d.status === 'idle');
    if (idleDriver) {
      pickup.driverId = idleDriver.id;
    }
  }

  res.json({ success: true, transaction: newTx, pickup });
});

// AI Waste Analysis utilizing Gemini 3.5-Flash
app.post("/api/analyze-waste", async (req, res) => {
  const { image, textPrompt, mimeType } = req.body;

  if (!aiClient) {
    // If no key is set, fallback to a smart programmatic simulation to keep app responsive
    console.log("No GEMINI_API_KEY detected. Using localized offline analysis fallback.");
    const fallbackCategories = ['General', 'Recycling', 'Organic', 'Hazardous', 'Electronic'];
    const chosenCategory = fallbackCategories.find(c => textPrompt?.toLowerCase().includes(c.toLowerCase())) || 'General';
    
    let sum = 20.00;
    let weight = 12.5;
    let fullness = 85;
    let tips: string[] = [];

    if (chosenCategory === 'Recycling') {
      sum = 15000; weight = 8.2; fullness = 90;
      tips = ["Break down cardboard boxes flat.", "Rinse food containers thoroughly.", "Do not include greasy pizza boxes."];
    } else if (chosenCategory === 'Organic') {
      sum = 12000; weight = 18.0; fullness = 75;
      tips = ["Drain liquid content to reduce smell.", "Use compostable paper bags.", "Keep the lid sealed to keep pests out."];
    } else if (chosenCategory === 'Hazardous') {
      sum = 45000; weight = 5.5; fullness = 40;
      tips = ["Keep chemicals in original packaging.", "Never mix different hazardous liquids.", "Store in a cool, dry place."];
    } else if (chosenCategory === 'Electronic') {
      sum = 30000; weight = 14.2; fullness = 60;
      tips = ["Remove internal lithium batteries first.", "Delete personal data from devices.", "Keep cables tied neatly."];
    } else {
      sum = 25000; weight = 15.0; fullness = 95;
      tips = ["Tie trash bags securely.", "Avoid placing heavy bricks or dirt.", "Keep the bin handle facing the street."];
    }

    const mockResult: AIAnalysisResult = {
      wasteCategory: chosenCategory as any,
      confidence: 0.95,
      estimatedFullness: fullness,
      estimatedWeightKg: weight,
      agreedSum: sum,
      sortingTips: tips,
      recommendedAction: `Schedule a pickup for your ${chosenCategory} waste. Disposal rate of ₦${sum.toLocaleString()} applies.`
    };

    return res.json(mockResult);
  }

  try {
    let contents: any = [];

    if (image) {
      const imagePart = {
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: image,
        },
      };
      contents.push(imagePart);
    }

    const defaultInstruction = "Analyze this waste bin state or garbage description. Detect waste category (General, Recycling, Organic, Hazardous, or Electronic), estimate bin fullness %, estimate weight in kg, recommend immediate action, and calculate an agreed disposal rate (sum) between ₦15,000 and ₦112,500 based on category and weight. Provide exactly 3 helpful sorting safety guidelines.";
    contents.push({ text: textPrompt ? `${defaultInstruction} Context: ${textPrompt}` : defaultInstruction });

    const response = await aiClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: "You are a professional AI Waste Consultant of an eco-friendly waste management company. Provide precise, eco-conscious trash classifications, bin full estimations, weight estimates, and clean waste sorting guidelines.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            wasteCategory: {
              type: Type.STRING,
              description: "Must be one of: General, Recycling, Organic, Hazardous, Electronic"
            },
            confidence: {
              type: Type.NUMBER,
              description: "Fraction between 0.0 and 1.0 representing classification confidence"
            },
            estimatedFullness: {
              type: Type.NUMBER,
              description: "Estimate fill level of the bin/waste pile as a percentage from 0 to 100"
            },
            estimatedWeightKg: {
              type: Type.NUMBER,
              description: "Estimated weight of materials in kg"
            },
            agreedSum: {
              type: Type.NUMBER,
              description: "Calculated eco-service fee in Nigerian Naira (NGN). Recycling is cheapest (15000-22500), Organic (18000-30000), General (30000-45000), Electronic (45000-67500), Hazardous is premium (67500-112500)."
            },
            sortingTips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of exactly 3 professional sorting or preparing tips for this category"
            },
            recommendedAction: {
              type: Type.STRING,
              description: "A short, actionable call-to-action string recommending pickup."
            }
          },
          required: ["wasteCategory", "confidence", "estimatedFullness", "estimatedWeightKg", "agreedSum", "sortingTips", "recommendedAction"]
        }
      }
    });

    const parsedResult = JSON.parse(response.text || "{}");
    res.json(parsedResult);
  } catch (err: any) {
    console.error("Gemini waste analysis failed:", err);
    res.status(500).json({ error: "Failed to perform AI waste analysis.", details: err.message });
  }
});

// Configure Vite middleware in development or static serving in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Smart Waste server running on port ${PORT}`);
  });
}

startServer();
