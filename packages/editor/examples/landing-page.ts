import type { PageBuilderDocument } from "../types";

/**
 * Example landing page template
 * Demonstrates a typical SaaS landing page structure
 */
export const landingPageTemplate: PageBuilderDocument = {
  root: {
    props: {
      title: "Landing Page",
      description: "A beautiful landing page to showcase your product",
      slug: "landing",
      background: "default",
      spacing: "none",
    },
  },
  content: [
    {
      type: "Hero",
      props: {
        id: "hero",
        eyebrow: "Welcome",
        heading: "Build Amazing Products Faster",
        description:
          "The complete platform for modern teams. Collaborate, ship, and scale with confidence.",
        backgroundGradient: "custom",
        overlayOpacity: 60,
        primaryButtonLabel: "Get Started",
        primaryButtonHref: "/signup",
        secondaryButtonLabel: "Learn More",
        secondaryButtonHref: "#features",
        align: "center",
        height: "screen",
      },
    },
    {
      type: "Section",
      props: {
        id: "stats",
        background: "muted",
        padding: "lg",
        width: "default",
        align: "center",
      },
      children: [
        {
          type: "Stats",
          props: {
            id: "company-stats",
            columns: "3",
            animated: false,
            stats: [
              {
                id: "1",
                icon: "Users",
                number: "10,000+",
                label: "Active Users",
                gradient: "custom",
              },
              {
                id: "2",
                icon: "Globe",
                number: "150+",
                label: "Countries",
                gradient: "blue",
              },
              {
                id: "3",
                icon: "Star",
                number: "4.9/5",
                label: "User Rating",
                gradient: "purple",
              },
            ],
          },
        },
      ],
    },
    {
      type: "Section",
      props: {
        id: "features",
        background: "default",
        padding: "lg",
        width: "default",
        align: "center",
      },
      children: [
        {
          type: "Heading",
          props: {
            text: "Everything you need to succeed",
            level: "h2",
            size: "2xl",
            align: "center",
            eyebrow: "Features",
          },
        },
        {
          type: "Text",
          props: {
            text: "Powerful features designed to help your team move faster and work smarter.",
            size: "lg",
            align: "center",
            tone: "muted",
          },
        },
        {
          type: "Spacer",
          props: {
            size: "md",
          },
        },
        {
          type: "Features",
          props: {
            id: "main-features",
            columns: "3",
            iconPosition: "top",
            cardVariant: "default",
            features: [
              {
                id: "1",
                icon: "Zap",
                title: "Lightning Fast",
                description:
                  "Optimized performance to keep your team productive and efficient.",
              },
              {
                id: "2",
                icon: "Shield",
                title: "Secure by Default",
                description:
                  "Enterprise-grade security to protect your data and privacy.",
              },
              {
                id: "3",
                icon: "Sparkles",
                title: "AI-Powered",
                description:
                  "Intelligent automation to streamline your workflows.",
              },
            ],
          },
        },
      ],
    },
    {
      type: "Section",
      props: {
        id: "testimonial",
        gradient: "purple",
        padding: "lg",
        width: "default",
        align: "center",
      },
      children: [
        {
          type: "Testimonial",
          props: {
            id: "customer-testimonial",
            quote:
              "This platform has completely transformed how our team works. The productivity gains have been incredible!",
            author: "Sarah Johnson",
            role: "CEO, TechCorp",
            rating: 5,
            background: "default",
          },
        },
      ],
    },
    {
      type: "Section",
      props: {
        id: "pricing",
        background: "muted",
        padding: "lg",
        width: "default",
        align: "center",
      },
      children: [
        {
          type: "PricingTable",
          props: {
            id: "pricing-tiers",
            heading: "Simple, Transparent Pricing",
            description: "Choose the plan that fits your needs",
            tiers: [
              {
                id: "1",
                name: "Starter",
                price: "$29",
                period: "per month",
                popular: false,
                buttonLabel: "Start Free Trial",
                buttonHref: "/signup?plan=starter",
                features: [
                  { id: "1", text: "Up to 10 team members", included: true },
                  { id: "2", text: "Basic analytics", included: true },
                  { id: "3", text: "24/7 email support", included: true },
                  { id: "4", text: "Advanced features", included: false },
                  { id: "5", text: "Priority support", included: false },
                ],
              },
              {
                id: "2",
                name: "Professional",
                price: "$99",
                period: "per month",
                popular: true,
                buttonLabel: "Start Free Trial",
                buttonHref: "/signup?plan=pro",
                features: [
                  { id: "1", text: "Up to 50 team members", included: true },
                  { id: "2", text: "Advanced analytics", included: true },
                  { id: "3", text: "24/7 priority support", included: true },
                  { id: "4", text: "Advanced features", included: true },
                  { id: "5", text: "Custom integrations", included: false },
                ],
              },
              {
                id: "3",
                name: "Enterprise",
                price: "Custom",
                period: "contact us",
                popular: false,
                buttonLabel: "Contact Sales",
                buttonHref: "/contact",
                features: [
                  { id: "1", text: "Unlimited team members", included: true },
                  { id: "2", text: "Advanced analytics", included: true },
                  { id: "3", text: "24/7 priority support", included: true },
                  { id: "4", text: "Advanced features", included: true },
                  { id: "5", text: "Custom integrations", included: true },
                ],
              },
            ],
          },
        },
      ],
    },
    {
      type: "Section",
      props: {
        id: "faq",
        background: "default",
        padding: "lg",
        width: "default",
        align: "center",
      },
      children: [
        {
          type: "FAQ",
          props: {
            id: "common-questions",
            heading: "Frequently Asked Questions",
            description: "Find answers to common questions about our platform",
            faqs: [
              {
                id: "1",
                question: "How do I get started?",
                answer:
                  "Simply sign up for a free trial and follow our onboarding guide. You'll be up and running in minutes!",
              },
              {
                id: "2",
                question: "Can I change my plan later?",
                answer:
                  "Yes! You can upgrade or downgrade your plan at any time from your account settings.",
              },
              {
                id: "3",
                question: "What payment methods do you accept?",
                answer:
                  "We accept all major credit cards, PayPal, and can arrange invoicing for enterprise customers.",
              },
              {
                id: "4",
                question: "Is there a free trial?",
                answer:
                  "Yes, we offer a 14-day free trial with no credit card required. You'll have access to all features during the trial.",
              },
            ],
          },
        },
      ],
    },
    {
      type: "CTA",
      props: {
        id: "final-cta",
        heading: "Ready to transform your workflow?",
        description:
          "Join thousands of teams already using our platform to build better products faster.",
        primaryButtonLabel: "Start Free Trial",
        primaryButtonHref: "/signup",
        secondaryButtonLabel: "Schedule a Demo",
        secondaryButtonHref: "/demo",
        layout: "centered",
        backgroundGradient: "custom",
        benefits: [
          "14-day free trial",
          "No credit card required",
          "Cancel anytime",
        ],
      },
    },
  ],
};

