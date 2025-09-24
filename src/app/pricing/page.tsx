'use client';

import { useState } from 'react';

export default function PricingPage() {
  const [selectedPackage, setSelectedPackage] = useState('5-photos');

  const packages = [
    {
      id: '5-photos',
      name: '5 Photos Package',
      price: 59.99,
      photos: 5,
      description: 'Perfect for small events and quick memories',
      features: [
        '5 photos → 1 video',
        'Under 45 seconds duration',
        'Royalty-free music included',
        '2-6 rerenders included',
        'HD quality output',
        'Instant download'
      ],
      popular: true
    },
    {
      id: '10-photos',
      name: '10 Photos Package',
      price: 99.99,
      photos: 10,
      description: 'Ideal for weddings, anniversaries, and special events',
      features: [
        '10 photos → 1 video',
        'Under 45 seconds duration',
        'Royalty-free music included',
        '2-6 rerenders included',
        'HD quality output',
        'Instant download',
        'Priority processing'
      ],
      popular: false
    }
  ];

  const professionalService = {
    name: 'Professional Service',
    description: 'Custom videos up to 3 minutes with professional editing',
    features: [
      'Up to 3 minutes duration',
      'Custom music selection',
      'Text overlays and captions',
      'Professional editing',
      'Unlimited revisions',
      '4K quality output',
      'Personal consultation'
    ],
    cta: 'Contact Us for Quote'
  };

  const rerenderCredits = [
    { credits: 1, price: 9.99 },
    { credits: 3, price: 24.99, savings: 'Save 17%' },
    { credits: 5, price: 39.99, savings: 'Save 20%' },
    { credits: 10, price: 74.99, savings: 'Save 25%' }
  ];

  const handlePurchase = (packageId: string) => {
    // TODO: Integrate with Stripe
    console.log(`Purchasing package: ${packageId}`);
    alert(`Redirecting to Stripe checkout for ${packageId}...`);
  };

  const handleProfessionalContact = () => {
    // TODO: Add contact form or email
    console.log('Contacting for professional service');
    alert('Please email us at professional@bloom.ai for a custom quote');
  };

  return (
    <div className="bg-gray-50 min-h-screen py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Simple, One-Time Pricing
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            No subscriptions, no hidden fees. Pay once and create your video.
          </p>
        </div>

        {/* Main Packages */}
        <div className="grid md:grid-cols-2 gap-8 mb-16 max-w-4xl mx-auto">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`relative bg-white rounded-2xl shadow-lg border-2 p-8 ${
                pkg.popular ? 'border-blue-500' : 'border-gray-200'
              }`}
            >
              {pkg.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                </div>
              )}
              
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{pkg.name}</h3>
                <p className="text-gray-600 mb-4">{pkg.description}</p>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900">
                    ${pkg.price}
                  </span>
                  <span className="text-gray-600"> one-time</span>
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {pkg.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handlePurchase(pkg.id)}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
                  pkg.popular
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                }`}
              >
                Create My Video
              </button>
            </div>
          ))}
        </div>

        {/* Professional Service */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 mb-16 max-w-4xl mx-auto">
          <div className="text-center text-white">
            <h2 className="text-3xl font-bold mb-4">{professionalService.name}</h2>
            <p className="text-xl text-purple-100 mb-8">{professionalService.description}</p>
            
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div className="text-left">
                <h3 className="text-xl font-semibold mb-4">What's Included:</h3>
                <ul className="space-y-2">
                  {professionalService.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <svg className="w-5 h-5 text-purple-200 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-purple-100">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="text-center">
                <div className="bg-white/20 rounded-lg p-6">
                  <p className="text-2xl font-bold mb-2">Custom Quote</p>
                  <p className="text-purple-100">Based on your specific needs</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleProfessionalContact}
              className="bg-white hover:bg-gray-100 text-purple-600 px-8 py-4 rounded-lg text-lg font-semibold transition-colors"
            >
              {professionalService.cta}
            </button>
          </div>
        </div>

        {/* Rerender Credits */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Need More Rerenders?
            </h2>
            <p className="text-lg text-gray-600">
              Each package includes 2-6 rerenders. Need more? Buy additional credits.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {rerenderCredits.map((credit) => (
              <div key={credit.credits} className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 text-center">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {credit.credits} Rerender{credit.credits > 1 ? 's' : ''}
                </h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-gray-900">${credit.price}</span>
                  {credit.savings && (
                    <div className="text-sm text-green-600 font-medium">{credit.savings}</div>
                  )}
                </div>
                <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 py-2 px-4 rounded-lg font-semibold transition-colors">
                  Buy Credits
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Frequently Asked Questions
          </h2>
          
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                What if I'm not happy with my video?
              </h3>
              <p className="text-gray-600">
                Each package includes 2-6 rerenders at no extra cost. If you're still not satisfied, you can purchase additional rerender credits or contact our support team.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                How long does it take to create my video?
              </h3>
              <p className="text-gray-600">
                Most videos are created in under 45 seconds. Professional service videos may take 1-3 business days depending on complexity.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Can I use the music commercially?
              </h3>
              <p className="text-gray-600">
                Yes! All music in our library is royalty-free and can be used for personal and commercial purposes.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                What photo formats do you accept?
              </h3>
              <p className="text-gray-600">
                We accept JPG, PNG, and HEIC formats. Photos should be at least 1080p for best quality results.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}