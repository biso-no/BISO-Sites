import type { PageBuilderDocument } from "../types";

/**
 * Example about page template
 * Demonstrates a typical company about page structure
 */
export const aboutPageTemplate: PageBuilderDocument = {
  root: {
    props: {
      title: "About Us",
      description: "Learn more about our company, mission, and team",
      slug: "about",
      background: "default",
      spacing: "none",
    },
  },
  content: [
    {
      type: "Hero",
      props: {
        id: "about-hero",
        eyebrow: "About Us",
        heading: "Building the Future Together",
        description:
          "We're on a mission to empower teams around the world to do their best work.",
        backgroundGradient: "blue",
        overlayOpacity: 70,
        align: "center",
        height: "medium",
      },
    },
    {
      type: "Section",
      props: {
        id: "mission",
        background: "default",
        padding: "lg",
        width: "default",
        align: "center",
      },
      children: [
        {
          type: "Heading",
          props: {
            text: "Our Mission",
            level: "h2",
            size: "2xl",
            align: "center",
          },
        },
        {
          type: "Text",
          props: {
            text: "We believe that great work happens when teams have the right tools and environment to collaborate effectively. Our platform is designed to remove friction, increase productivity, and help teams focus on what matters most - creating amazing products and experiences.",
            size: "lg",
            align: "center",
            tone: "default",
          },
        },
      ],
    },
    {
      type: "Section",
      props: {
        id: "values",
        background: "muted",
        padding: "lg",
        width: "default",
        align: "center",
      },
      children: [
        {
          type: "Heading",
          props: {
            text: "Our Values",
            level: "h2",
            size: "2xl",
            align: "center",
            eyebrow: "What Drives Us",
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
            id: "company-values",
            columns: "3",
            iconPosition: "top",
            cardVariant: "default",
            features: [
              {
                id: "1",
                icon: "Heart",
                title: "Customer First",
                description:
                  "Everything we do is centered around delivering value to our customers and helping them succeed.",
              },
              {
                id: "2",
                icon: "Target",
                title: "Excellence",
                description:
                  "We strive for excellence in every aspect of our work, from product quality to customer support.",
              },
              {
                id: "3",
                icon: "Users",
                title: "Collaboration",
                description:
                  "We believe in the power of teamwork and foster a culture of open communication and mutual support.",
              },
              {
                id: "4",
                icon: "Lightbulb",
                title: "Innovation",
                description:
                  "We embrace change and continuously seek new ways to improve and push boundaries.",
              },
              {
                id: "5",
                icon: "Shield",
                title: "Integrity",
                description:
                  "We operate with honesty, transparency, and ethical practices in everything we do.",
              },
              {
                id: "6",
                icon: "Globe",
                title: "Inclusivity",
                description:
                  "We celebrate diversity and create an environment where everyone feels welcome and valued.",
              },
            ],
          },
        },
      ],
    },
    {
      type: "Section",
      props: {
        id: "stats-section",
        gradient: "purple",
        padding: "lg",
        width: "default",
        align: "center",
      },
      children: [
        {
          type: "Heading",
          props: {
            text: "By the Numbers",
            level: "h2",
            size: "2xl",
            align: "center",
          },
        },
        {
          type: "Spacer",
          props: {
            size: "md",
          },
        },
        {
          type: "Stats",
          props: {
            id: "company-stats",
            columns: "4",
            animated: false,
            stats: [
              {
                id: "1",
                icon: "Users",
                number: "50+",
                label: "Team Members",
                gradient: "blue",
              },
              {
                id: "2",
                icon: "Calendar",
                number: "5",
                label: "Years in Business",
                gradient: "cyan",
              },
              {
                id: "3",
                icon: "Globe",
                number: "150+",
                label: "Countries Served",
                gradient: "green",
              },
              {
                id: "4",
                icon: "Award",
                number: "10+",
                label: "Industry Awards",
                gradient: "orange",
              },
            ],
          },
        },
      ],
    },
    {
      type: "Section",
      props: {
        id: "team",
        background: "default",
        padding: "lg",
        width: "default",
        align: "center",
      },
      children: [
        {
          type: "Heading",
          props: {
            text: "Meet Our Team",
            level: "h2",
            size: "2xl",
            align: "center",
            eyebrow: "Leadership",
          },
        },
        {
          type: "Text",
          props: {
            text: "We're a diverse team of passionate individuals working together to build something great.",
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
          type: "TeamGrid",
          props: {
            id: "leadership-team",
            columns: "3",
            members: [
              {
                id: "1",
                name: "Alex Thompson",
                role: "CEO & Co-Founder",
                bio: "Former VP of Engineering at a Fortune 500 company. Passionate about building products that make a difference.",
                linkedin: "https://linkedin.com/in/alexthompson",
                twitter: "https://twitter.com/alexthompson",
                email: "alex@company.com",
              },
              {
                id: "2",
                name: "Sarah Chen",
                role: "CTO & Co-Founder",
                bio: "20+ years of experience in software architecture and engineering leadership.",
                linkedin: "https://linkedin.com/in/sarahchen",
                twitter: "https://twitter.com/sarahchen",
                email: "sarah@company.com",
              },
              {
                id: "3",
                name: "Marcus Rodriguez",
                role: "Head of Design",
                bio: "Award-winning designer with a focus on creating delightful user experiences.",
                linkedin: "https://linkedin.com/in/marcusrodriguez",
                twitter: "https://twitter.com/marcusrodriguez",
                email: "marcus@company.com",
              },
            ],
          },
        },
      ],
    },
    {
      type: "Section",
      props: {
        id: "timeline",
        background: "muted",
        padding: "lg",
        width: "default",
        align: "center",
      },
      children: [
        {
          type: "Heading",
          props: {
            text: "Our Journey",
            level: "h2",
            size: "2xl",
            align: "center",
            eyebrow: "Timeline",
          },
        },
        {
          type: "Spacer",
          props: {
            size: "md",
          },
        },
        {
          type: "CardGrid",
          props: {
            id: "company-timeline",
            columns: "3",
            cardVariant: "default",
            cards: [
              {
                id: "1",
                title: "2019 - Founded",
                description:
                  "Company founded by Alex and Sarah with a vision to revolutionize team collaboration.",
              },
              {
                id: "2",
                title: "2020 - First Customers",
                description:
                  "Launched our beta and onboarded our first 100 customers.",
              },
              {
                id: "3",
                title: "2021 - Series A",
                description:
                  "Raised $10M in Series A funding to accelerate product development and growth.",
              },
              {
                id: "4",
                title: "2022 - Global Expansion",
                description:
                  "Expanded to serve customers in over 50 countries worldwide.",
              },
              {
                id: "5",
                title: "2023 - Product Launch",
                description:
                  "Launched our flagship product to widespread acclaim and rapid adoption.",
              },
              {
                id: "6",
                title: "2024 - Today",
                description:
                  "Serving 10,000+ customers and continuing to innovate and grow.",
              },
            ],
          },
        },
      ],
    },
    {
      type: "CTA",
      props: {
        id: "join-us-cta",
        heading: "Join Our Team",
        description:
          "We're always looking for talented individuals who share our passion for building great products.",
        primaryButtonLabel: "View Open Positions",
        primaryButtonHref: "/careers",
        layout: "centered",
        backgroundGradient: "custom",
      },
    },
  ],
};

