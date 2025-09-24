import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            AI Filmmaking
            <span className="text-blue-600"> Made Simple</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Transform your precious photos into cinematic videos automatically. From baby's first steps to Grandma's memories, 
            create beautiful video stories for life's most important moments.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/story"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-colors"
            >
              Start Creating
            </Link>
            <Link
              href="/pricing"
              className="bg-white hover:bg-gray-50 text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold border-2 border-blue-600 transition-colors"
            >
              View Pricing
            </Link>
            </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Perfect for Every Life Moment
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            From weddings to funerals, birthdays to anniversaries - create meaningful videos for life's most important events
          </p>
              </div>
              
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white rounded-xl p-8 shadow-lg">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Automatic Video Creation</h3>
            <p className="text-gray-600">
              Upload your photos and let our AI create a beautiful video in under 45 seconds with seamless transitions
            </p>
      </div>

          <div className="bg-white rounded-xl p-8 shadow-lg">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Royalty-Free Music</h3>
            <p className="text-gray-600">
              Choose from our extensive library of royalty-free music to perfectly match your video's mood and style
            </p>
          </div>
          
          <div className="bg-white rounded-xl p-8 shadow-lg">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Professional Service</h3>
            <p className="text-gray-600">
              Need something special? Hire our professionals to create custom videos up to 3 minutes with music and text overlays
            </p>
          </div>
                  </div>
                </div>

      {/* CTA Section */}
      <div className="bg-blue-600 py-20">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Create Your Video?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Turn your precious memories into beautiful videos in minutes, not hours
          </p>
          <Link
            href="/story"
            className="bg-white hover:bg-gray-100 text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold transition-colors inline-block"
          >
            Get Started Now
          </Link>
        </div>
      </div>
    </div>
  );
}
