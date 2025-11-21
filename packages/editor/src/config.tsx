import { type Config, DropZone } from "@measured/puck";
import { Hero, type HeroProps } from "@repo/ui/components/sections/hero";
import { About, type AboutProps } from "@repo/ui/components/sections/about";
import { JoinUs, type JoinUsProps } from "@repo/ui/components/sections/join-us";
import { News, type NewsProps } from "@repo/ui/components/sections/news";
import { Events, type EventsProps } from "@repo/ui/components/sections/events";
import { Section, type SectionProps } from "@repo/ui/components/puck/section";
import { Hero as GenericHero, type HeroProps as GenericHeroProps } from "@repo/ui/components/puck/hero";
import { FeatureGrid, type FeatureGridProps } from "@repo/ui/components/puck/feature-grid";
import { CTA, type CTAProps } from "@repo/ui/components/puck/cta";
import { Columns, type ColumnsProps } from "@repo/ui/components/puck/columns";
import { AccordionBlock, type AccordionBlockProps } from "@repo/ui/components/puck/accordion";
import { FileUpload } from "@repo/ui/components/file-upload";

type EditorJoinUsProps = Omit<JoinUsProps, 'memberFeatures'> & {
  memberFeatures: { feature: string }[];
};


type Props = {
  Hero: HeroProps;
  About: AboutProps;
  JoinUs: EditorJoinUsProps;
  News: NewsProps;
  Events: EventsProps;
  Section: SectionProps;
  GenericHero: GenericHeroProps;
  FeatureGrid: FeatureGridProps;
  CTA: CTAProps;
  Columns: ColumnsProps;
  Accordion: AccordionBlockProps;
};

export const config: Config<Props> = {
  components: {
    Accordion: {
        fields: {
            type: {
                type: "radio",
                options: [
                    { label: "Single Open", value: "single" },
                    { label: "Allow Multiple", value: "multiple" }
                ]
            },
            items: {
                type: "array",
                getItemSummary: (item) => item.title || "Item",
                arrayFields: {
                    title: { type: "text" },
                    content: { type: "textarea" }
                }
            }
        },
        render: (props) => <AccordionBlock {...props} />,
        defaultProps: {
            type: "single",
            items: [
                { title: "Question 1", content: "Answer to question 1." },
                { title: "Question 2", content: "Answer to question 2." }
            ]
        }
    },
    Columns: {
        fields: {
            layout: {
                type: "select",
                options: [
                    { label: "Two Columns (1:1)", value: "1:1" },
                    { label: "Two Columns (2:1)", value: "2:1" },
                    { label: "Two Columns (1:2)", value: "1:2" },
                    { label: "Three Columns (1:1:1)", value: "1:1:1" },
                ]
            },
            gap: {
                type: "select",
                options: [
                    { label: "Small", value: "sm" },
                    { label: "Medium", value: "md" },
                    { label: "Large", value: "lg" },
                ]
            },
            verticalAlign: {
                type: "select",
                options: [
                    { label: "Top", value: "top" },
                    { label: "Center", value: "center" },
                    { label: "Bottom", value: "bottom" },
                ]
            }
        },
        render: ({ layout = "1:1", ...props }) => {
            const colCount = layout.split(":").length;
            return (
                <Columns layout={layout} {...props}>
                    {Array.from({ length: colCount }).map((_, i) => (
                        <DropZone key={i} zone={`col-${i}`} />
                    ))}
                </Columns>
            );
        },
        defaultProps: {
            layout: "1:1",
            gap: "md",
            verticalAlign: "top"
        }
    },
    FeatureGrid: {
        fields: {
            title: { type: "text" },
            subtitle: { type: "textarea" },
            columns: {
                type: "select",
                options: [
                    { label: "2", value: 2 },
                    { label: "3", value: 3 },
                    { label: "4", value: 4 },
                ]
            },
            variant: {
                type: "select",
                options: [
                    { label: "Card", value: "card" },
                    { label: "Icon", value: "icon" },
                    { label: "Simple", value: "simple" },
                ]
            },
            align: {
                type: "radio",
                options: [
                    { label: "Center", value: "center" },
                    { label: "Left", value: "left" },
                ]
            },
            items: {
                type: "array",
                getItemSummary: (item) => item.title || "Feature",
                arrayFields: {
                    title: { type: "text" },
                    description: { type: "textarea" },
                    icon: {
                        type: "select",
                        options: [
                            { label: "Sparkles", value: "Sparkles" },
                            { label: "Gift", value: "Gift" },
                            { label: "Crown", value: "Crown" },
                            { label: "Zap", value: "Zap" },
                            { label: "Check", value: "Check" },
                            { label: "Calendar", value: "Calendar" },
                            { label: "Briefcase", value: "Briefcase" },
                            { label: "Rocket", value: "Rocket" },
                            { label: "Trophy", value: "Trophy" },
                            { label: "Megaphone", value: "Megaphone" },
                            { label: "Link", value: "Link" },
                            { label: "Users", value: "Users" },
                            { label: "Globe", value: "Globe" },
                            { label: "BookOpen", value: "BookOpen" },
                            { label: "Building", value: "Building" },
                            { label: "Heart", value: "Heart" }
                        ]
                    },
                    href: { type: "text" },
                }
            }
        },
        render: (props) => <FeatureGrid {...props} />,
        defaultProps: {
            columns: 3,
            variant: "card",
            align: "center",
            items: [
                { title: "Feature 1", description: "Description 1", icon: "Sparkles" },
                { title: "Feature 2", description: "Description 2", icon: "Zap" },
                { title: "Feature 3", description: "Description 3", icon: "Crown" },
            ]
        }
    },
    CTA: {
        fields: {
            title: { type: "text" },
            description: { type: "textarea" },
            variant: {
                type: "select",
                options: [
                    { label: "Default", value: "default" },
                    { label: "Card", value: "card" },
                    { label: "Brand", value: "brand" },
                ]
            },
            align: {
                type: "radio",
                options: [
                    { label: "Center", value: "center" },
                    { label: "Left", value: "left" },
                ]
            },
            buttons: {
                type: "array",
                arrayFields: {
                    label: { type: "text" },
                    href: { type: "text" },
                    variant: {
                        type: "select",
                        options: [
                            { label: "Default", value: "default" },
                            { label: "Outline", value: "outline" },
                            { label: "Ghost", value: "ghost" },
                            { label: "White", value: "white" },
                        ]
                    }
                }
            }
        },
        render: (props) => <CTA {...props} />,
        defaultProps: {
            title: "Ready to join?",
            description: "Get started today.",
            variant: "brand",
            buttons: [{ label: "Join Now", href: "/join", variant: "white" }]
        }
    },
    Section: {
      fields: {
        backgroundColor: {
          type: "select",
          options: [
            { label: "White", value: "white" },
            { label: "Gray", value: "gray" },
            { label: "Primary", value: "primary" },
            { label: "Dark", value: "dark" },
          ],
        },
        padding: {
          type: "select",
          options: [
            { label: "None", value: "none" },
            { label: "Small", value: "sm" },
            { label: "Medium", value: "md" },
            { label: "Large", value: "lg" },
            { label: "Extra Large", value: "xl" },
          ],
        },
        maxWidth: {
          type: "select",
          options: [
            { label: "Default", value: "default" },
            { label: "Full", value: "full" },
            { label: "Narrow", value: "narrow" },
          ],
        },
        id: { type: "text" },
      },
      render: ({ children, ...props }) => (
        <Section {...props}>
          <DropZone zone="content" />
        </Section>
      ),
      defaultProps: {
        backgroundColor: "white",
        padding: "md",
        maxWidth: "default",
      },
    },
    GenericHero: {
      fields: {
        type: {
          type: "select",
          options: [
            { label: "Center", value: "center" },
            { label: "Left", value: "left" },
            { label: "Split", value: "split" },
          ],
        },
        height: {
          type: "select",
          options: [
            { label: "Full Screen", value: "full" },
            { label: "Large", value: "large" },
            { label: "Medium", value: "medium" },
            { label: "Small", value: "small" },
          ],
        },
        title: { type: "text" },
        subtitle: { type: "textarea" },
        badge: { type: "text" },
        backgroundImage: { type: "image" },
        image: { type: "image" },
        overlay: { 
            type: "radio", 
            options: [{ label: "Yes", value: true }, { label: "No", value: false }] 
        },
        buttons: {
          type: "array",
          arrayFields: {
            label: { type: "text" },
            href: { type: "text" },
            variant: {
              type: "select",
              options: [
                { label: "Default", value: "default" },
                { label: "Outline", value: "outline" },
                { label: "Ghost", value: "ghost" },
                { label: "Link", value: "link" },
                { label: "Glass", value: "glass" },
                { label: "Gradient", value: "gradient" },
              ],
            },
          },
        },
      },
      render: (props) => <GenericHero {...props} />,
      defaultProps: {
        type: "center",
        height: "medium",
        title: "Hero Title",
        subtitle: "This is a generic hero component that can be customized.",
        buttons: [{ label: "Get Started", href: "/", variant: "default" }],
        overlay: true,
      },
    },
    Hero: {
      fields: {
        featuredContent: {
          type: "array",
          getItemSummary: (item) => item.title || "Content Item",
          arrayFields: {
            title: { type: "text" },
            description: { type: "textarea" },
            imageUrl: { type: "text" },
            link: { type: "text" },
            type: { 
              type: "select",
              options: [
                { label: "Event", value: "event" },
                { label: "News", value: "news" },
                { label: "Custom", value: "custom" }
              ]
            },
            content_id: { type: "text" }
          }
        },
        labels: {
            type: "object",
            objectFields: {
                badge: { type: "text" },
                badgeElevated: { type: "text" },
                subtitle: { type: "textarea" },
                ctaJoin: { type: "text" },
                ctaViewEvents: { type: "text" },
                featuredLabel: { type: "text" },
                learnMore: { type: "text" },
                viewAll: { type: "text" }
            }
        }
      },
      render: (props) => <Hero {...props} />,
      defaultProps: {
        featuredContent: [
             { title: "Welcome to BISO", description: "The student organisation for BI Norwegian Business School", type: "custom" }
        ],
        labels: {
            badge: "Your Student",
            badgeElevated: "Organisation",
            subtitle: "We are here for you.",
            ctaJoin: "Join Us",
            ctaViewEvents: "View Events",
            featuredLabel: "Featured",
            learnMore: "Learn More",
            viewAll: "View All"
        }
      }
    },
    About: {
        fields: {
            stats: {
                type: "array",
                arrayFields: {
                    number: { type: "text" },
                    label: { type: "text" },
                    iconName: { 
                        type: "select",
                        options: [
                            { label: "Calendar", value: "Calendar" },
                            { label: "Briefcase", value: "Briefcase" },
                            { label: "Rocket", value: "Rocket" },
                            { label: "Trophy", value: "Trophy" }
                        ]
                    }
                }
            },
            values: {
                type: "array",
                arrayFields: {
                    title: { type: "text" },
                    description: { type: "textarea" },
                    iconName: {
                        type: "select",
                        options: [
                            { label: "Megaphone", value: "Megaphone" },
                            { label: "Link", value: "Link" },
                            { label: "Sparkles", value: "Sparkles" }
                        ]
                    },
                    gradient: { type: "text" }
                }
            },
            mainContent: {
                type: "object",
                objectFields: {
                    tag: { type: "text" },
                    titleLine1: { type: "text" },
                    titleLine2: { type: "text" },
                    paragraph1: { type: "textarea" },
                    paragraph2: { type: "textarea" }
                }
            },
            videoUrl: { type: "text" }
        },
        render: (props) => <About {...props} />,
        defaultProps: {
            stats: [
                { number: "100+", label: "Events", iconName: "Calendar" },
                { number: "50+", label: "Jobs", iconName: "Briefcase" },
                { number: "20+", label: "Societies", iconName: "Rocket" }
            ],
            values: [
                { title: "Impact", description: "We make an impact.", iconName: "Megaphone", gradient: "from-[#3DA9E0] to-[#001731]" }
            ],
            mainContent: {
                tag: "About",
                titleLine1: "Premier Student",
                titleLine2: "Community",
                paragraph1: "We are the student union...",
                paragraph2: "Join us today."
            }
        }
    },
    JoinUs: {
        fields: {
            tag: { type: "text" },
            titleLine1: { type: "text" },
            titleLine2: { type: "text" },
            subtitle: { type: "textarea" },
            heroBadge: { type: "text" },
            heroSubtitle: { type: "textarea" },
            memberFeaturesHeader: { type: "text" },
            memberFeatures: { 
                type: "array",
                arrayFields: {
                    // Puck array of strings is a bit tricky, usually needs object
                     // But I'll assume string support or wrapper
                     // Actually Puck requires object for array items usually?
                     // Let's use a simple object wrapper in component if needed, but component takes string[]
                     // In Puck config, we can adapt. 
                     // For now, I'll just use text fields in array.
                     feature: { type: "text" } 
                },
                // I need to map the output
            },
            benefits: {
                type: "array",
                arrayFields: {
                    text: { type: "text" },
                    iconName: {
                        type: "select",
                        options: [
                            { label: "Sparkles", value: "Sparkles" },
                            { label: "Gift", value: "Gift" },
                            { label: "Crown", value: "Crown" },
                            { label: "Zap", value: "Zap" },
                            { label: "Check", value: "Check" }
                        ]
                    }
                }
            },
            durations: {
                type: "array",
                arrayFields: {
                    name: { type: "text" },
                    price: { type: "text" },
                    period: { type: "text" },
                    savings: { type: "text" },
                    popular: { type: "radio", options: [{label: "Yes", value: true}, {label: "No", value: false}] },
                    gradient: { type: "text" }
                }
            },
            cta: {
                type: "object",
                objectFields: {
                    title: { type: "text" },
                    subtitle: { type: "textarea" },
                    buttonText: { type: "text" }
                }
            }
        },
        render: (props) => {
            const componentProps = {
                ...props,
                memberFeatures: props.memberFeatures?.map((f) => f.feature) || []
            };
            return <JoinUs {...componentProps} />;
        },
        defaultProps: {
            tag: "Membership",
            titleLine1: "Join the",
            titleLine2: "Community",
            subtitle: "Unlock exclusive benefits.",
            heroBadge: "Why Join?",
            heroSubtitle: "Being a member pays off.",
            memberFeaturesHeader: "All memberships include:",
            memberFeatures: [{feature: "Event Access"}, {feature: "Discounts"}],
            benefits: [{text: "Social Events", iconName: "Sparkles"}],
            durations: [
                { name: "1 Year", price: "200 NOK", period: "/year", popular: true, gradient: "from-purple-600 to-pink-600" }
            ],
            cta: {
                title: "Not sure?",
                subtitle: "Contact us.",
                buttonText: "Contact"
            }
        }
    },
    News: {
        fields: {
            news: {
                type: "array",
                getItemSummary: (item) => item.title,
                arrayFields: {
                    title: { type: "text" },
                    description: { type: "textarea" },
                    image: { type: "text" },
                    content_id: { type: "text" },
                    $id: { type: "text" },
                    $createdAt: { type: "text" } // User would have to manually enter date string?
                }
            },
            labels: {
                type: "object",
                objectFields: {
                    empty: { type: "text" },
                    emptyDescription: { type: "text" },
                    cta: { type: "text" },
                    stayUpdated: { type: "text" },
                    titleDefault: { type: "text" },
                    readMore: { type: "text" },
                    viewAllNews: { type: "text" }
                }
            }
        },
        render: (props) => <News {...props} />,
        defaultProps: {
            news: [],
            labels: {
                empty: "No news yet",
                emptyDescription: "Check back later.",
                cta: "Update",
                stayUpdated: "Stay",
                titleDefault: "Updated",
                readMore: "Read More",
                viewAllNews: "View All News"
            }
        }
    },
    Events: {
        fields: {
            events: {
                type: "array",
                getItemSummary: (item) => item.title,
                arrayFields: {
                    title: { type: "text" },
                    image: { type: "text" },
                    start_date: { type: "text" }, // ISO string
                    end_date: { type: "text" },
                    location: { type: "text" },
                    category: { type: "select", options: [{label: "Social", value: "Social"}, {label: "Career", value: "Career"}, {label: "Academic", value: "Academic"}] },
                    attendees: { type: "number" },
                    content_id: { type: "text" },
                    $id: { type: "text" }
                }
            },
            labels: {
                type: "object",
                objectFields: {
                    empty: { type: "text" },
                    emptyDescription: { type: "text" },
                    upcomingEvents: { type: "text" },
                    dontMissOut: { type: "text" },
                    amazingExperiences: { type: "text" },
                    description: { type: "textarea" },
                    registerNow: { type: "text" },
                    viewAllEvents: { type: "text" }
                }
            }
        },
        render: (props) => <Events {...props} />,
        defaultProps: {
            events: [],
            labels: {
                empty: "No events",
                emptyDescription: "Check back later",
                upcomingEvents: "Upcoming Events",
                dontMissOut: "Don't miss out on",
                amazingExperiences: "amazing experiences",
                description: "Join us at our events.",
                registerNow: "Register Now",
                viewAllEvents: "View All Events"
            }
        }
    }
  }
};

export default config;
