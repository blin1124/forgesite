"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function TemplatesPage() {
  const templates = [
    { name: "Coffee Shop", image: "/templates/coffee_shop.svg" },
    { name: "Gym", image: "/templates/gym.svg" },
    { name: "Realtor", image: "/templates/realtor.svg" },
    { name: "Restaurant", image: "/templates/restaurant.svg" },
    { name: "Dentist", image: "/templates/dentist.svg" },
    { name: "Photography", image: "/templates/photography.svg" },
    { name: "Portfolio", image: "/templates/portfolio.svg" },
    { name: "Nonprofit", image: "/templates/nonprofit.svg" },
  ];

  const [selectedTemplate, setSelectedTemplate] = useState<null | typeof templates[0]>(null);

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 py-20 px-8">
      <div className="max-w-6xl mx-auto text-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-5xl font-extrabold mb-6 bg-gradient-to-r from-indigo-600 to-blue-500 text-transparent bg-clip-text"
        >
          Explore AI-Generated Website Templates
        </motion.h1>
        <p className="text-gray-600 max-w-2xl mx-auto mb-12">
          Browse a growing collection of pre-designed templates you can instantly
          customize with ForgeSite AI. Each design is optimized for speed,
          mobile-friendliness, and effortless editing.
        </p>

        {/* Template Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {templates.map((template, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group relative overflow-hidden rounded-xl shadow-lg bg-white hover:shadow-2xl transition transform hover:scale-105 cursor-pointer"
              onClick={() => setSelectedTemplate(template)}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 to-blue-400/10 opacity-0 group-hover:opacity-100 transition"></div>
              <img
                src={template.image}
                alt={template.name}
                className="w-full h-56 object-contain bg-gray-100 p-6 transition duration-300 group-hover:opacity-90"
              />
              <div className="absolute bottom-0 left-0 right-0 py-3 bg-white bg-opacity-90 backdrop-blur text-indigo-700 font-semibold text-lg shadow-inner">
                {template.name}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-16">
          <Link
            href="/builder"
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-semibold rounded-md shadow-md transition"
          >
            Start Building Now
          </Link>
        </div>
      </div>

      {/* Modal Preview */}
      <AnimatePresence>
        {selectedTemplate && (
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 relative overflow-hidden"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <button
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl z-10"
                onClick={() => setSelectedTemplate(null)}
              >
                ×
              </button>

              {/* Scrollable Content */}
              <div className="max-h-[85vh] overflow-y-auto p-8">
                <h2 className="text-3xl font-bold mb-6 text-indigo-700 text-center">
                  {selectedTemplate.name} Template Preview
                </h2>

                {/* Mock Scrollable Layout */}
                <div className="space-y-10">
                  {/* Hero section */}
                  <div className="bg-gradient-to-r from-indigo-600 to-blue-500 text-white p-10 rounded-xl shadow-lg text-center">
                    <h3 className="text-4xl font-bold mb-2">
                      Welcome to {selectedTemplate.name}
                    </h3>
                    <p className="text-lg opacity-90">
                      A sleek, AI-generated design perfect for your brand.
                    </p>
                  </div>

                  {/* Features */}
                  <div className="grid md:grid-cols-3 gap-6">
                    {["Fast", "Mobile-Ready", "Beautiful"].map((f, j) => (
                      <div
                        key={j}
                        className="p-6 border rounded-xl bg-gray-50 hover:shadow-md transition"
                      >
                        <h4 className="font-semibold text-indigo-600 mb-2">{f}</h4>
                        <p className="text-gray-600 text-sm">
                          Fully customizable, SEO-friendly, and crafted for your
                          business needs.
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Sample section */}
                  <div className="bg-gray-100 p-8 rounded-xl text-center">
                    <h4 className="text-2xl font-semibold mb-4 text-indigo-700">
                      Showcase your services
                    </h4>
                    <p className="text-gray-600 max-w-xl mx-auto">
                      Each template includes sections for your offerings, testimonials,
                      and images to highlight what makes your business unique.
                    </p>
                  </div>

                  {/* Testimonials */}
                  <div className="p-8 bg-white border rounded-xl shadow-sm">
                    <h4 className="text-2xl font-semibold mb-6 text-indigo-700 text-center">
                      What Customers Say
                    </h4>
                    <div className="grid sm:grid-cols-2 gap-6">
                      {["Incredible quality!", "Super easy to edit!"].map((t, k) => (
                        <div
                          key={k}
                          className="p-6 bg-gray-50 rounded-lg text-gray-700 italic border-l-4 border-indigo-500"
                        >
                          “{t}”
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Use This Template & Live Preview Buttons */}
                <div className="text-center mt-10 mb-4 flex flex-col sm:flex-row justify-center gap-4">
                  <Link
                    href={`/builder?template=${encodeURIComponent(selectedTemplate.name)}`}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-semibold rounded-md shadow-md transition"
                  >
                    Use This Template
                  </Link>
                  <Link
                    href={`/builder?template=${encodeURIComponent(selectedTemplate.name)}&preview=true`}
                    className="px-8 py-3 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-lg font-semibold rounded-md shadow-md transition"
                  >
                    Live Preview
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}



