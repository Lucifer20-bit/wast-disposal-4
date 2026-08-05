import React, { useState } from 'react';
import { Camera, Upload, AlertCircle, Sparkles, Check, DollarSign, Scale, ArrowRight, ShieldCheck } from 'lucide-react';
import { AIAnalysisResult } from '../types';

interface AiWasteAnalyzerProps {
  onQuoteAccepted: (result: AIAnalysisResult) => void;
  customerAddress: string;
}

const PRESETS = [
  {
    name: 'Cardboard & Plastics',
    description: 'Stacked cardboard boxes and clean empty milk bottles ready for recycling.',
    category: 'Recycling',
    icon: '📦',
    textPrompt: 'Stacked corrugated cardboard shipping boxes, flat-packed, and 5 clean HDPE plastic milk containers.'
  },
  {
    name: 'Household Organic Waste',
    description: 'Food leftovers, fruit peels, and coffee grounds inside a compost container.',
    category: 'Organic',
    icon: '🍎',
    textPrompt: 'Kitchen scraps, green vegetable peels, organic food leftovers, and compostable coffee filter bags.'
  },
  {
    name: 'Broken Flat-screen TV',
    description: 'An old 42-inch LCD television with internal wiring and components.',
    category: 'Electronic',
    icon: '📺',
    textPrompt: 'E-waste television monitor, plastic frame casing, and various copper power cables.'
  },
  {
    name: 'Car Batteries & Paint Cans',
    description: 'Partially used paint containers and a lead-acid vehicle battery.',
    category: 'Hazardous',
    icon: '⚠️',
    textPrompt: 'Hazardous metal paint tins, solvent smell, and a sealed heavy lead-acid rechargeable battery.'
  }
];

export default function AiWasteAnalyzer({ onQuoteAccepted, customerAddress }: AiWasteAnalyzerProps) {
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [textPrompt, setTextPrompt] = useState('');
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        // Strip the data:image/*;base64, prefix for the server-side API
        const cleaned = base64String.split(',')[1];
        resolve(cleaned);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCustomFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      setAnalysis(null);
      setError(null);
      // Pre-populate description
      setTextPrompt(`Analyzing custom photo upload: ${file.name}`);
    }
  };

  const handleSelectPreset = (preset: typeof PRESETS[0]) => {
    setImagePreview(null);
    setCustomFile(null);
    setTextPrompt(preset.textPrompt);
    setAnalysis(null);
    setError(null);
    triggerAnalysis(preset.textPrompt, null);
  };

  const triggerAnalysis = async (promptText: string, fileToAnalyze: File | null) => {
    setLoading(true);
    setError(null);
    try {
      let base64Image = null;
      let mimeType = null;

      if (fileToAnalyze) {
        base64Image = await fileToBase64(fileToAnalyze);
        mimeType = fileToAnalyze.type;
      }

      const response = await fetch('/api/analyze-waste', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image,
          mimeType: mimeType,
          textPrompt: promptText,
        }),
      });

      if (!response.ok) {
        throw new Error('Analysis server error. Please try again.');
      }

      const result: AIAnalysisResult = await response.json();
      setAnalysis(result);
    } catch (err: any) {
      setError(err.message || 'Failed to communicate with AI Consultant.');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomAnalyze = () => {
    if (!textPrompt && !customFile) {
      setError('Please write a short description or upload an image.');
      return;
    }
    triggerAnalysis(textPrompt, customFile);
  };

  return (
    <div id="ai-waste-analyzer" className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:p-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-200">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 mb-2">
            <Sparkles className="w-3.5 h-3.5" /> AI Consultant Powered
          </span>
          <h2 className="text-2xl font-bold text-slate-800">Smart Eco-Quote Analyser</h2>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Upload a photo of your waste or describe it to receive an automated quote and disposal compliance guidelines instantly.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Input Selection */}
        <div className="lg:col-span-5 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Option 1: Snap or Upload Photo</h3>
            <div className="relative group border-2 border-dashed border-slate-200 hover:border-emerald-500 transition-colors rounded-xl p-4 flex flex-col items-center justify-center text-center bg-slate-50 cursor-pointer">
              <input
                id="file-upload-input"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              {imagePreview ? (
                <div className="relative w-full h-40 rounded-lg overflow-hidden">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-xs font-medium">Click to replace photo</p>
                  </div>
                </div>
              ) : (
                <div className="py-6">
                  <div className="w-12 h-12 rounded-full bg-slate-200/50 flex items-center justify-center mb-3 mx-auto text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">
                    <Camera className="w-6 h-6" />
                  </div>
                  <p className="text-slate-600 text-sm font-medium">Drag or tap to upload photo</p>
                  <p className="text-slate-400 text-xs mt-1">Supports PNG, JPG, WEBP</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Option 2: Try Quick Preset Scenarios</h3>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((preset, idx) => (
                <button
                  id={`preset-btn-${idx}`}
                  key={idx}
                  onClick={() => handleSelectPreset(preset)}
                  className="flex flex-col items-start p-3 text-left border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/20 transition-all rounded-xl cursor-pointer"
                >
                  <span className="text-2xl mb-1">{preset.icon}</span>
                  <span className="text-xs font-semibold text-slate-700 line-clamp-1">{preset.name}</span>
                  <span className="text-[10px] text-slate-400 font-medium">{preset.category}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="custom-prompt">
              Describe Waste Items (Optional)
            </label>
            <textarea
              id="custom-prompt"
              value={textPrompt}
              onChange={(e) => setTextPrompt(e.target.value)}
              placeholder="E.g., I have three large cardboard boxes filled with packaging peanuts and bubble wrap..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-700 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
            />
          </div>

          <button
            id="analyze-submit-btn"
            disabled={loading}
            onClick={handleCustomAnalyze}
            className="w-full py-3.5 px-5 bg-slate-800 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm shadow-slate-200"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>AI Analyzing Materials...</span>
              </div>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Request AI Smart Quote</span>
              </>
            )}
          </button>

          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 text-rose-700 rounded-xl text-xs border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Right Column: AI Analysis Output Results */}
        <div className="lg:col-span-7 bg-slate-50/50 rounded-xl border border-slate-200 p-6 flex flex-col justify-between">
          {analysis ? (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 mb-2">
                    Classification Result
                  </span>
                  <h4 className="text-xl font-bold text-slate-800">{analysis.wasteCategory} Material</h4>
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-1 font-medium">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>AI Confidence: {(analysis.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Service Quote</span>
                  <div className="text-3xl font-black text-slate-800 flex items-center justify-end">
                    <span className="text-lg font-bold text-slate-500">$</span>
                    <span>{analysis.agreedSum.toFixed(2)}</span>
                  </div>
                  <span className="text-[10px] font-medium text-emerald-600 block mt-0.5">Eco-disposal Rate</span>
                </div>
              </div>

              {/* Bento Grid Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium mb-1">
                    <Scale className="w-3.5 h-3.5 text-slate-400" />
                    <span>Estimated Weight</span>
                  </div>
                  <span className="text-lg font-bold text-slate-700">{analysis.estimatedWeightKg} kg</span>
                  <span className="text-[10px] text-slate-400 block font-medium">Approximate payload</span>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium mb-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Volume Fullness</span>
                  </div>
                  <span className="text-lg font-bold text-slate-700">{analysis.estimatedFullness}%</span>
                  <span className="text-[10px] text-slate-400 block font-medium">Bin density level</span>
                </div>
              </div>

              {/* Sorting tips guidelines */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <h5 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5">
                  Safe Sorting & Preparation Guide:
                </h5>
                <ul className="space-y-2">
                  {analysis.sortingTips.map((tip, index) => (
                    <li key={index} className="flex items-start gap-2 text-slate-600 text-xs">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommended Action CTA banner */}
              <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5 text-amber-800 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                <div>
                  <span className="font-semibold block">Regulatory Notice:</span>
                  <span>{analysis.recommendedAction} Pickup scheduling includes full tracking and carbon emission reporting.</span>
                </div>
              </div>

              <button
                id="accept-quote-btn"
                onClick={() => onQuoteAccepted(analysis)}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm shadow-emerald-200 text-sm"
              >
                <span>Accept Quote & Go To Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              {loading ? (
                <div className="space-y-4">
                  <div className="relative w-16 h-16 mx-auto">
                    <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
                    <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
                  </div>
                  <div>
                    <h4 className="text-slate-700 font-bold text-sm">Gemini AI is consulting...</h4>
                    <p className="text-slate-400 text-xs mt-1">Classifying materials, calculating optimal rates, and preparing safety compliance tips.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="text-4xl">🤖</span>
                  <h4 className="text-slate-600 font-bold text-sm">Awaiting Material Inputs</h4>
                  <p className="text-slate-400 text-xs max-w-xs mx-auto">
                    Choose one of our presets on the left or upload your custom waste photo to generate your eco-contract.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
