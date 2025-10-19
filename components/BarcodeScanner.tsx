/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Camera, Keyboard } from 'lucide-react';
import Webcam from 'react-webcam';
import Quagga from '@ericblade/quagga2';
import { getProductByBarcode, extractOFFNutrients, calculateNCV } from '@/lib/openfoodfacts-api';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (ingredientData: any) => void;
}

export function BarcodeScanner({ isOpen, onClose, onSelect }: BarcodeScannerProps) {
  const [manualBarcode, setManualBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('manual');
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<HTMLDivElement>(null);

  const lookupBarcode = useCallback(
    async (barcode: string) => {
      setLoading(true);
      try {
        const product = await getProductByBarcode(barcode);
        const nutrients = extractOFFNutrients(product);
        const ncv = calculateNCV(nutrients.calories, nutrients.protein, nutrients.fiber);

        onSelect({
          name: product.product_name || 'Unknown Product',
          calories_per_100g: nutrients.calories,
          protein_per_100g: nutrients.protein,
          carbs_per_100g: nutrients.carbs,
          fat_per_100g: nutrients.fat,
          fiber_per_100g: nutrients.fiber,
          ncv_score: ncv,
          brand: product.brands || '',
          store_name: product.stores || '',
        });

        onClose();
      } catch (error) {
        alert('Product not found. Try manual entry.');
        setScanMode('manual');
      }
      setLoading(false);
    },
    [onClose, onSelect]
  );

  useEffect(() => {

    const handleDetected = async (result: any) => {
    const code = result.codeResult.code;
    if (!code) return;

    Quagga.stop();
    setScanning(false);
    await lookupBarcode(code);
  };

    const startScanner = () => {
    if (!scannerRef.current) return;

    Quagga.init(
      {
        inputStream: {
          type: 'LiveStream',
          target: scannerRef.current,
          constraints: {
            width: 640,
            height: 480,
            facingMode: 'environment',
          },
        },
        decoder: {
          readers: [
            'ean_reader',
            'ean_8_reader',
            'upc_reader',
            'upc_e_reader',
          ],
        },
        locate: true,
      },
      (err) => {
        if (err) {
          console.error('Quagga init error:', err);
          alert('Camera access denied or not available');
          setScanMode('manual');
          return;
        }
        Quagga.start();
        setScanning(true);
      }
    );

    Quagga.onDetected(handleDetected);
  };
  
    if (isOpen && scanMode === 'camera' && scannerRef.current && !scanning) {
      startScanner();
    }

    return () => {
      if (scanning) {
        Quagga.stop();
      }
    };
  }, [isOpen, scanMode, scanning, lookupBarcode]);

  

  

  

  const handleManualLookup = () => {
    if (!manualBarcode.trim()) return;
    lookupBarcode(manualBarcode);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Scan Barcode</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (scanning) Quagga.stop();
                setScanning(false);
                setScanMode('camera');
              }}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                scanMode === 'camera'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Camera className="w-4 h-4 inline mr-2" />
              Camera
            </button>
            <button
              onClick={() => {
                if (scanning) {
                  Quagga.stop();
                  setScanning(false);
                }
                setScanMode('manual');
              }}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                scanMode === 'manual'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Keyboard className="w-4 h-4 inline mr-2" />
              Manual
            </button>
          </div>

          {scanMode === 'camera' ? (
            <div>
              <div
                ref={scannerRef}
                className="relative w-full aspect-[4/3] bg-black rounded-lg overflow-hidden"
              >
                {!scanning && (
                  <div className="absolute inset-0 flex items-center justify-center text-white">
                    Initializing camera...
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Point camera at barcode. It will scan automatically.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enter Barcode Number
              </label>
              <input
                type="text"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualLookup()}
                placeholder="e.g., 3017620422003"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={handleManualLookup}
                disabled={loading}
                className="w-full mt-3 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-semibold"
              >
                {loading ? 'Looking up...' : 'Lookup Product'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}