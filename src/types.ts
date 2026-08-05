export interface Bin {
  id: string;
  ownerName: string;
  address: string;
  lat: number;
  lng: number;
  type: 'General' | 'Recycling' | 'Organic' | 'Hazardous' | 'Electronic';
  sizeGallons: number;
  fillLevel: number; // 0 to 100
  isFullNotificationSent: boolean;
  lastUpdated: string;
}

export interface PickupRequest {
  id: string;
  binId: string;
  customerName: string;
  address: string;
  lat: number;
  lng: number;
  binType: 'General' | 'Recycling' | 'Organic' | 'Hazardous' | 'Electronic';
  fillLevel: number;
  status: 'pending' | 'scheduled' | 'en_route' | 'completed' | 'cancelled';
  agreedSum: number;
  paymentStatus: 'unpaid' | 'paid' | 'processing';
  paymentId?: string;
  requestedAt: string;
  scheduledFor?: string;
  completedAt?: string;
  driverId?: string;
}

export interface Driver {
  id: string;
  name: string;
  status: 'idle' | 'en_route' | 'resting';
  vehicleNumber: string;
  vehicleType: string;
  vehicleCapacityKg: number;
  currentLat: number;
  currentLng: number;
  targetLat?: number;
  targetLng?: number;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
}

export interface PaymentTransaction {
  id: string;
  amount: number;
  status: 'succeeded' | 'failed' | 'processing';
  customerName: string;
  binType: string;
  date: string;
  cardLast4?: string;
  paymentMethod: string; // 'card' | 'bank' | 'transfer'
}

export interface AIAnalysisResult {
  wasteCategory: 'General' | 'Recycling' | 'Organic' | 'Hazardous' | 'Electronic';
  confidence: number; // e.g. 0.92
  estimatedFullness: number; // e.g. 85
  estimatedWeightKg: number; // e.g. 15
  agreedSum: number; // e.g. 25
  sortingTips: string[];
  recommendedAction: string;
}
