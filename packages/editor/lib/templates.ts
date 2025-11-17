import type { PageBuilderDocument } from "../types";
import { generateId } from "./field-helpers";

/**
 * Pre-configured page templates
 */

export const templates = {
  /**
   * Simple About Page Template
   */
  aboutPage: (): PageBuilderDocument => ({
    root: {
      props: {
        title: "About Us",
        description: "Learn more about our company",
        slug: "about",
        background: "default",
        spacing: "md",
      },
    },
    content: [
      {
        type: "Hero",
        props: {
          id: generateId(),
          heading: "About Our Company",
          description: "We're on a mission to make a difference",
          align: "center",
          height: "medium",
          backgroundGradient: "custom",
          overlayOpacity: 60,
        },
      },
      {
        type: "Section",
        props: {
          id: generateId(),
          background: "default",
          padding: "lg",
          width: "default",
          align: "left",
          content: {
            zones: {
              content: [
                {
                  type: "Heading",
                  props: {
                    id: generateId(),
                    text: "Our Story",
                    level: "h2",
                    size: "2xl",
                    align: "left",
                  },
                },
                {
                  type: "Text",
                  props: {
                    id: generateId(),
                    text: "Tell your company's story here...",
                    size: "base",
                    align: "left",
                    tone: "default",
                  },
                },
              ],
            },
          },
        },
      },
      {
        type: "Stats",
        props: {
          id: generateId(),
          dataSource: "manual",
          stats: [
            {
              id: "1",
              number: "10+",
              label: "Years Experience",
              gradient: "custom",
            },
            {
              id: "2",
              number: "500+",
              label: "Happy Clients",
              gradient: "custom",
            },
            {
              id: "3",
              number: "50+",
              label: "Team Members",
              gradient: "custom",
            },
          ],
          columns: "3",
          animated: false,
        },
      },
      {
        type: "TeamGrid",
        props: {
          id: generateId(),
          dataSource: "manual",
          members: [
            {
              id: "1",
              name: "Jane Doe",
              role: "CEO",
              bio: "Brief bio here",
            },
          ],
          columns: "3",
        },
      },
    ],
    zones: {},
  }),

  /**
   * Contact Page Template
   */
  contactPage: (): PageBuilderDocument => ({
    root: {
      props: {
        title: "Contact Us",
        description: "Get in touch with our team",
        slug: "contact",
        background: "default",
        spacing: "md",
      },
    },
    content: [
      {
        type: "Hero",
        props: {
          id: generateId(),
          heading: "Get In Touch",
          description: "We'd love to hear from you",
          align: "center",
          height: "medium",
          backgroundGradient: "custom",
          overlayOpacity: 60,
        },
      },
      {
        type: "Section",
        props: {
          id: generateId(),
          background: "default",
          padding: "lg",
          width: "default",
          content: {
            zones: {
              content: [
                {
                  type: "CardGrid",
                  props: {
                    id: generateId(),
                    dataSource: "manual",
                    cards: [
                      {
                        id: "1",
                        title: "Email Us",
                        description: "contact@example.com",
                      },
                      {
                        id: "2",
                        title: "Call Us",
                        description: "+1 (555) 123-4567",
                      },
                      {
                        id: "3",
                        title: "Visit Us",
                        description: "123 Main St, City, State",
                      },
                    ],
                    columns: "3",
                    cardVariant: "default",
                  },
                },
              ],
            },
          },
        },
      },
      {
        type: "FAQ",
        props: {
          id: generateId(),
          dataSource: "manual",
          heading: "Frequently Asked Questions",
          faqs: [
            {
              id: "1",
              question: "What are your business hours?",
              answer: "We're open Monday-Friday, 9am-5pm.",
            },
            {
              id: "2",
              question: "How can I reach support?",
              answer: "Email us at support@example.com or call our hotline.",
            },
          ],
        },
      },
    ],
    zones: {},
  }),

  /**
   * Landing Page Template
   */
  landingPage: (): PageBuilderDocument => ({
    root: {
      props: {
        title: "Welcome",
        description: "Discover our amazing product",
        slug: "",
        background: "default",
        spacing: "md",
      },
    },
    content: [
      {
        type: "Hero",
        props: {
          id: generateId(),
          eyebrow: "Welcome",
          heading: "Your Amazing Product",
          description: "Transform your business with our innovative solution",
          align: "center",
          height: "screen",
          backgroundGradient: "custom",
          overlayOpacity: 60,
          primaryButtonLabel: "Get Started",
          primaryButtonHref: "#features",
          secondaryButtonLabel: "Learn More",
          secondaryButtonHref: "#about",
        },
      },
      {
        type: "Features",
        props: {
          id: generateId(),
          features: [
            {
              id: "1",
              title: "Fast & Reliable",
              description: "Lightning-fast performance you can count on",
            },
            {
              id: "2",
              title: "Easy to Use",
              description: "Intuitive interface designed for everyone",
            },
            {
              id: "3",
              title: "Secure",
              description: "Enterprise-grade security built-in",
            },
          ],
          columns: "3",
          iconPosition: "top",
          cardVariant: "default",
        },
      },
      {
        type: "CTA",
        props: {
          id: generateId(),
          heading: "Ready to get started?",
          description: "Join thousands of satisfied customers today",
          layout: "centered",
          backgroundGradient: "custom",
          primaryButtonLabel: "Start Free Trial",
          primaryButtonHref: "/signup",
        },
      },
    ],
    zones: {},
  }),

  /**
   * Blank Page Template
   */
  blankPage: (): PageBuilderDocument => ({
    root: {
      props: {
        title: "",
        description: "",
        slug: "",
        background: "default",
        spacing: "md",
      },
    },
    content: [],
    zones: {},
  }),
};

/**
 * Get all available templates
 */
export function getTemplates() {
  return Object.keys(templates).map((key) => ({
    id: key,
    name: key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim(),
  }));
}

/**
 * Get a template by ID
 */
export function getTemplate(id: keyof typeof templates): PageBuilderDocument {
  const template = templates[id];
  if (!template) {
    throw new Error(`Template "${id}" not found`);
  }
  return template();
}

