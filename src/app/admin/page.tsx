'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Copy, CheckCircle } from "lucide-react";

type GeneratedCode = {
  id: string;
  code: string;
  packageType: string;
  createdAt: string;
};

export default function AdminPage() {
  const [packageType, setPackageType] = useState('5-photos');
  const [quantity, setQuantity] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<GeneratedCode[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const generateCodes = async () => {
    setIsGenerating(true);
    
    try {
      const codes: GeneratedCode[] = [];
      for (let i = 0; i < quantity; i++) {
        const response = await fetch('/api/admin/generate-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packageType })
        });
        
        if (response.ok) {
          const data = await response.json();
          codes.push({
            id: data.id,
            code: data.code,
            packageType: data.package_type,
            createdAt: new Date().toLocaleString()
          });
        }
      }
      
      setGeneratedCodes(prev => [...codes, ...prev]);
    } catch (error) {
      console.error('Error generating codes:', error);
      alert('Failed to generate codes');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Admin - Code Generator
          </h1>
          <p className="text-lg text-gray-600">
            Generate redeemable codes for video packages
          </p>
        </div>

        {/* Code Generation Form */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Generate New Codes
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="packageType">Package Type</Label>
                <select
                  value={packageType}
                  onChange={(e) => setPackageType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="5-photos">5 Photos Package</option>
                  <option value="10-photos">10 Photos Package</option>
                </select>
              </div>
              
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                />
              </div>
              
              <div className="flex items-end">
                <Button
                  onClick={generateCodes}
                  disabled={isGenerating}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Generate Codes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Generated Codes List */}
        {generatedCodes.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Generated Codes ({generatedCodes.length})
              </h2>
              <div className="space-y-3">
                {generatedCodes.map((code) => (
                  <div key={code.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="font-mono text-lg font-semibold">
                        {code.code}
                      </div>
                      <div className="text-sm text-gray-500">
                        {code.packageType} • {code.createdAt}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(code.code)}
                    >
                      {copiedCode === code.code ? (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
