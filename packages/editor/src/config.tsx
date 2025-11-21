import type { Config } from "@measured/puck";
import { Hero, type HeroProps } from "@repo/ui/components/sections/hero";
import { About, type AboutProps } from "@repo/ui/components/sections/about";
import { JoinUs, type JoinUsProps } from "@repo/ui/components/sections/join-us";
import { News, type NewsProps } from "@repo/ui/components/sections/news";
import { Events, type EventsProps } from "@repo/ui/components/sections/events";

type EditorJoinUsProps = Omit<JoinUsProps, 'memberFeatures'> & {
  memberFeatures: { feature: string }[];
};

type Props = {
  Hero: HeroProps;
  About: AboutProps;
  JoinUs: EditorJoinUsProps;
  News: NewsProps;
  Events: EventsProps;
};

export const config: Config<Props> = {
  components: {
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
