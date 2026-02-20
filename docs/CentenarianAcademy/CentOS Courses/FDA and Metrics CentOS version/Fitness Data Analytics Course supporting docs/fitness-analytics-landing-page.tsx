import React, { useState } from 'react';
import { Heart, Activity, BarChart3, TrendingUp, Users, BookOpen, ArrowRight, Check, Star, Clock, Target, Zap } from 'lucide-react';

const FitnessAnalyticsLanding = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle form submission here
    console.log('Form submitted:', formData);
    setIsSubmitted(true);
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-fuchsia-600 to-pink-500 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-2 text-sm font-medium mb-6">
                <Star className="w-4 h-4" />
                Part of the World's Fastest Centenarian Specialization
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold leading-tight mb-6">
                Foundations of Fitness and 
                <span className="bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent"> Health Metrics</span>
              </h1>
              <p className="text-xl mb-8 text-purple-100">
                Learn to harness the power of personal metrics for better health decisions. 
                Transform your body's data into actionable insights for extraordinary longevity.
              </p>
              <div className="flex flex-wrap gap-4 mb-8">
                <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2">
                  <Clock className="w-5 h-5" />
                  <span>5-Week Course</span>
                </div>
                <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2">
                  <Users className="w-5 h-5" />
                  <span>Collaborative Learning</span>
                </div>
                <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2">
                  <BookOpen className="w-5 h-5" />
                  <span>Open Science Approach</span>
                </div>
              </div>
            </div>
            
            {/* Hero Visual */}
            <div className="relative">
              <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20">
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl p-6 text-white">
                    <Heart className="w-8 h-8 mb-4" />
                    <div className="text-3xl font-bold">72 BPM</div>
                    <div className="text-sm opacity-90">Resting Heart Rate</div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl p-6 text-white">
                    <Activity className="w-8 h-8 mb-4" />
                    <div className="text-3xl font-bold">8,547</div>
                    <div className="text-sm opacity-90">Daily Steps</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-400 to-violet-500 rounded-2xl p-6 text-white">
                    <Target className="w-8 h-8 mb-4" />
                    <div className="text-3xl font-bold">150/75</div>
                    <div className="text-sm opacity-90">Intensity Minutes</div>
                  </div>
                  <div className="bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl p-6 text-white">
                    <Zap className="w-8 h-8 mb-4" />
                    <div className="text-3xl font-bold">87%</div>
                    <div className="text-sm opacity-90">Sleep Quality</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Course Overview */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Turn Your Health Data Into Your Longevity Advantage
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Most people never learn to read their body's dashboard. By the end of this course, 
              you'll know exactly how to interpret your health signals and use that information 
              to make smart decisions every single day.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-fuchsia-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Track Like a Scientist</h3>
              <p className="text-gray-600">
                Learn the 4 essential metrics that predict longevity: heart rate variability, 
                intensity minutes, sleep quality, and daily movement patterns.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-fuchsia-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Target className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Optimize with Precision</h3>
              <p className="text-gray-600">
                Use device-guided feedback to achieve 150 moderate + 75 vigorous intensity 
                minutes weekly - the research-proven formula for 50% mortality reduction.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-fuchsia-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Build for Longevity</h3>
              <p className="text-gray-600">
                Create sustainable habits that compound over decades, following patterns 
                observed in centenarian populations worldwide.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Weekly Breakdown */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">5-Week Transformation Journey</h2>
            <p className="text-xl text-gray-600">Each week builds on the previous, creating a complete health optimization system</p>
          </div>

          <div className="space-y-8">
            {[
              {
                week: 1,
                title: "Foundations of Fitness and Health Metrics",
                description: "Master the 4 essential health metrics and learn to read your body's dashboard",
                topics: ["Resting Heart Rate", "Daily Steps", "Sleep Quality", "Calories Burned"],
                color: "from-purple-500 to-fuchsia-500"
              },
              {
                week: 2,
                title: "Wearable Technology & Data Collection",
                description: "Set up accurate tracking systems and understand device capabilities",
                topics: ["Device Selection", "App Integration", "Accuracy Validation", "Data Sync"],
                color: "from-blue-500 to-indigo-500"
              },
              {
                week: 3,
                title: "Data Analytics Basics",
                description: "Identify patterns, trends, and actionable insights from your metrics",
                topics: ["Pattern Recognition", "Trend Analysis", "Correlation Discovery", "N-of-1 Trials"],
                color: "from-green-500 to-emerald-500"
              },
              {
                week: 4,
                title: "Intensity Minutes as Longevity Metric",
                description: "Master the most powerful predictor of healthy aging",
                topics: ["Moderate vs Vigorous", "SMART Goals", "Device Optimization", "Weekly Targets"],
                color: "from-orange-500 to-red-500"
              },
              {
                week: 5,
                title: "Long-Term Health Trends & Sustained Improvement",
                description: "Create your personal centenarian optimization protocol",
                topics: ["Trend Interpretation", "Protocol Development", "Habit Systems", "Community Building"],
                color: "from-violet-500 to-purple-500"
              }
            ].map((week, index) => (
              <div key={index} className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
                <div className="flex flex-col lg:flex-row gap-8 items-start">
                  <div className="flex-shrink-0">
                    <div className={`w-20 h-20 bg-gradient-to-br ${week.color} rounded-2xl flex items-center justify-center text-white text-2xl font-bold`}>
                      {week.week}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Week {week.week}: {week.title}</h3>
                    <p className="text-gray-600 mb-4">{week.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {week.topics.map((topic, topicIndex) => (
                        <span key={topicIndex} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Specialization Context */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Part of the Complete Specialization</h2>
            <p className="text-xl text-gray-600">This foundational course connects to advanced programs for comprehensive health optimization</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 rounded-2xl p-8 border border-purple-200">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-fuchsia-500 rounded-xl flex items-center justify-center mb-6">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Course 1: Foundations</h3>
              <p className="text-gray-600 mb-4">Master health metrics and data-driven decision making</p>
              <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm inline-block">
                Current Course
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-200">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mb-6">
                <Target className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Course 2: Intervention Design</h3>
              <p className="text-gray-600 mb-4">Turn data into action with scientific intervention protocols</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 8-week intensive program</li>
                <li>• Personal experimentation framework</li>
                <li>• From tracker to health designer</li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 border border-green-200">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mb-6">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Course 3: Open Science</h3>
              <p className="text-gray-600 mb-4">Collaborative data collection and protocol experiments</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Citizen science methodology</li>
                <li>• Community data insights</li>
                <li>• Peer-reviewed protocols</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Lead Magnet Form */}
      <section className="py-20 bg-gradient-to-br from-purple-600 via-fuchsia-600 to-pink-500">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-3xl p-8 lg:p-12 shadow-2xl">
            {!isSubmitted ? (
              <>
                <div className="text-center mb-8">
                  <h2 className="text-4xl font-bold text-gray-900 mb-4">
                    Start Your Centenarian Journey Today
                  </h2>
                  <p className="text-xl text-gray-600">
                    Join our waitlist to be the first to know when enrollment opens. 
                    Get exclusive early access and special pricing.
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Enter your email"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter your phone number"
                    />
                  </div>
                  <button
                    onClick={handleSubmit}
                    className="w-full bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-bold py-4 px-8 rounded-lg hover:from-purple-700 hover:to-fuchsia-700 transition-all duration-200 flex items-center justify-center gap-2 text-lg"
                  >
                    Join the Waitlist
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-8 grid md:grid-cols-3 gap-6 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-600">
                    <Check className="w-5 h-5 text-green-500" />
                    <span>Early Access Pricing</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-gray-600">
                    <Check className="w-5 h-5 text-green-500" />
                    <span>Exclusive Bonuses</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-gray-600">
                    <Check className="w-5 h-5 text-green-500" />
                    <span>No Spam, Ever</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-4">Thank You!</h3>
                <p className="text-xl text-gray-600 mb-6">
                  You're now on the waitlist for the Foundations of Fitness and Health Metrics course.
                </p>
                <p className="text-gray-600">
                  We'll notify you as soon as enrollment opens with exclusive early access and special pricing.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">
            © 2024 Brand Anthony McDonald - World's Smallest Conglomerate
          </p>
          <p className="text-gray-500 mt-2">
            Building the foundation for becoming the World's Fastest Centenarian
          </p>
        </div>
      </footer>
    </div>
  );
};

export default FitnessAnalyticsLanding;