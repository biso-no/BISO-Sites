import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import {
  AlertTriangle,
  Building2,
  Clock,
  Cookie,
  Database,
  FileText,
  Globe,
  Lock,
  Mail,
  MessageSquare,
  RefreshCw,
  Scale,
  Shield,
  ShieldCheck,
  Smartphone,
  User,
  UserCheck,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | BISO",
  description:
    "Privacy statement for BISO - Learn how we handle your personal data securely and safely.",
};

const sections = [
  {
    id: "intro",
    title: "Introduction",
    icon: Shield,
    content: `BI Student Organization (BISO) is concerned with handling your personal data in a secure and safe manner. This privacy policy applies to students, applicants, employees, contractors, as well as stakeholders and visitors to BISO's website, services and applications.

This statement applies to the following services:
• https://biso.no
• BISO applications on Google Play and App Store`,
  },
  {
    id: "contact",
    title: "Contact Information",
    icon: Building2,
    content: `BISO is responsible for handling your personal data. If you have questions about the treatment or want to get in touch with us to exercise your rights, you will find our contact information below:

**BISO – BI Student Organization**
Address: Nydalsveien 37
Postcode/location: 0484, Oslo
Organization number: 987713380
E-mail address: contact@biso.no`,
  },
  {
    id: "what-is-personal-data",
    title: "What is Personal Data?",
    icon: User,
    content: `Personal data is defined as information that alone or together with other information can be used to identify, locate or contact a person. Information which alone cannot be linked to an individual may in cases where the information occurs together with other data still constitute personal information.

Examples of personal data include:
• Name
• Telephone number
• E-mail address
• Student ID (S-number)
• IP address`,
  },
  {
    id: "data-controller",
    title: "BISO as Data Controller",
    icon: Scale,
    content: `Processing of personal data involves all forms of handling personal data, such as data collection, analysis, registration, and storage. Who determines the purpose of processing personal data and which information is requested is the data controller.

BI Student Organization – BISO – is responsible for processing personal data that is collected and processed by BISO, cf. the EU's Personal Data Protection Regulation (GDPR) article 4 no. 7. The general manager is the overall controller for the processing of personal data at BISO.`,
  },
  {
    id: "purpose",
    title: "Purpose of Processing",
    icon: FileText,
    content: `BISO, as the controller, determines the purpose of the processing of personal data. All processing of personal data must have a specific, expressly stated purpose which is factually justified in BISO's operations. This follows from GDPR article 5 no. 1b.

Personal data that is obtained and collected is consequently limited to what is absolutely necessary to fulfill the purpose of the processing. The personal data collected for one specific purpose cannot later be used for another purpose without a new assessment.`,
  },
  {
    id: "what-we-offer",
    title: "What BISO Offers Members",
    icon: Users,
    content: `BISO wants to be a welcoming, inclusive and diverse arena for the students at BI. We work to offer our members an opportunity to maximize their student life through our main pillars:

• **Safety and Benefits** - Ensuring a secure environment with exclusive perks
• **Career Advantage** - Building professional networks and enhancing CVs
• **Social Network** - Connecting students and building lasting friendships

For students who choose to get involved in BISO, we offer a good working environment with varied, sometimes demanding, but always fun and educational tasks.`,
  },
  {
    id: "cookies",
    title: "Cookies",
    icon: Cookie,
    content: `Cookies are small text files that are placed on your computer when you download a website.

Storage of information and processing of this information is not permitted unless the user has both been informed about and has given consent to the collection. The information on how BISO collects the user's data must be easily accessible.

We only use cookies to give you a better user experience on our services, so you don't have to fill in fields again every time you are on our pages and forms.`,
  },
  {
    id: "data-collection",
    title: "Information We Collect",
    icon: Database,
    content: `When you apply for a position, order a service or product, become a member, or visit our website, you may be asked to provide information. Depending on the situation, we may request:

• Name
• E-mail address
• Telephone number
• S-number (Student ID)
• Resume
• Position or area of responsibility
• Other information such as in-depth questions or answers to forms/surveys
• Technical information: web address, IP address, user behaviour, browser type, language and operating system`,
  },
  {
    id: "website-tracking",
    title: "Website Data Collection",
    icon: Globe,
    content: `When you visit our website, information about you is recorded. We use Google Analytics to understand user behavior.

**When purchasing a product through the online store, we register:**
• First name and last name
• Telephone number
• Email
• Address
• Postal code and post office

**When filling in the recruitment portal form, we register:**
• First name and last name
• Email
• Telephone number
• Application
• Resume`,
  },
  {
    id: "app-collection",
    title: "App Data Collection",
    icon: Smartphone,
    content: `BISO will NEVER collect any information about our users without their knowledge or approval. By registering a user account in our application, you consent to BISO collecting personal data.

**Reimbursements module:**
• Full name, Phone number, Email, Address, Postcode and city, Bank account number

**Elections module:**
• Full name, Email address

**Membership module:**
• Full name, Email address, Student ID (s-number)`,
  },
  {
    id: "legal-basis",
    title: "Legal Basis for Processing",
    icon: Scale,
    content: `In order to process personal data, in addition to the purpose, there must be a legal basis. The general requirement follows from GDPR Article 6. For sensitive personal data, an additional legal basis regulated in GDPR Article 9 is required.

When you accept our Terms & Conditions, an agreement has been entered between you and BISO, providing consent. You can withdraw your consent at any time. If you withdraw your consent, we will remove the information we have about you. However, this will mean that any memberships will be cancelled.`,
  },
  {
    id: "security",
    title: "Security of Your Data",
    icon: Lock,
    content: `BISO.no has strict routines and measures to secure your personal data. Information will only be disclosed/transferred to others in a secure manner.

BISO.no uses HTTPS communication (HTTP over TLS / HTTP over SSL / HTTP Secure) for encrypted and secure transmission of data between you and us.

If the data subject submits the request electronically, and unless the data subject requests otherwise, the information must be provided in a normal electronic form.`,
  },
  {
    id: "data-usage",
    title: "How We Use Your Data",
    icon: FileText,
    content: `The information you provide is used for the following purposes:

• Sales and marketing activities in the form of direct e-mail contact
• Customer care and information about our products
• Obtaining statistics and information on user behavior to improve our services
• Delivering a more personal experience and content that interests you
• Responding to inquiries and requests
• Creating and maintaining dialogue
• Sending information that may be of interest to you`,
  },
  {
    id: "data-sharing",
    title: "Information Sharing",
    icon: Users,
    content: `Information provided will be available to a limited number of people in the organisation who hold positions within IT, Marketing, Consulting or customer support. The general manager, student assistants and permanent staff will also be granted access.

**We do not sell your personal data to third parties.**

If there is an ongoing sale or customer dialogue between you, us and any of our partners, we may share: Name, Email, and Type of membership.`,
  },
  {
    id: "data-storage",
    title: "Where Data is Stored",
    icon: Database,
    content: `BISO stores information about the user according to the regulations stated in this policy.

**Data storage locations:**
• **biso.no**: Our database where we store user information from our websites
• **Google Analytics**: Statistical data about the websites, application, and its users
• **Google Firebase**: Our database for mobile applications, such as the BISO application`,
  },
  {
    id: "your-rights",
    title: "Your Rights",
    icon: UserCheck,
    content: `You have the right to receive information about what information we have about you. You can also demand that we correct incorrect information or delete your information.

**Right to information** - All information about BISO's processing must be included in this privacy policy
**Right to access** - You can know which personal data BISO processes about you
**Right to correction** - You can have incorrect, out-of-date or incomplete information corrected
**Right to deletion** - You can demand that we delete personal data about you
**Right to object** - You can object to processing under certain conditions
**Right to limitation** - You may demand that processing is restricted in some cases
**Right to complain** - You can complain about the processing if you believe it's incorrect`,
  },
  {
    id: "deletion",
    title: "Deleting Your Data",
    icon: RefreshCw,
    content: `**BISO.no**
If you wish to have your personal data deleted, please contact contact@biso.no. When making an inquiry, please justify why you want the personal data deleted and state which personal data you wish to have deleted.

**BISO App**
If you wish to have your personal data removed from our application, please select the "Delete my user" option in your profile page. Deleting your user account will permanently delete all personal data. NB! Your user account is non-recoverable. Please back up your personal documents before deleting your account.`,
  },
  {
    id: "retention",
    title: "Data Retention Period",
    icon: Clock,
    content: `We only process the personal data for as long as it takes to fulfill the purpose of their collection, after which we delete the information.

If you have an active membership or position with us, we will keep your information for **6 months** from the last contact, then we remove the information.

An active dialogue is defined as interaction with BISO via e-mail, downloading material, buying products, registering via the portal, having an active membership, or holding an active position in the last 6 months.`,
  },
  {
    id: "email",
    title: "Email Correspondence",
    icon: Mail,
    content: `We use e-mail, ID/s number and telephone as part of daily work. Relevant information from telephone conversations and e-mail exchanges is registered in the customer system.

Employees are responsible for deleting messages that are no longer relevant, and at least every year reviewing and deleting unnecessary content.

**Important:** Sensitive personal data must not be sent by e-mail. Regular e-mail is unencrypted. We do not encourage you to send confidential, sensitive or other confidential information via e-mail.`,
  },
  {
    id: "updates",
    title: "Policy Updates",
    icon: RefreshCw,
    content: `BISO may revise this privacy policy as a result of our processing of personal data changing or as a result of new personal data legislation.

When the privacy policy changes, an updated version will be published on our website.`,
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-linear-to-br from-brand-overlay-from via-brand-overlay-via to-brand-overlay-to py-20 text-white sm:py-28">
        <div className="absolute inset-0 bg-linear-to-t from-brand-overlay-from/70 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_50%),radial-gradient(circle_at_bottom_right,rgba(61,169,224,0.15),transparent_60%)]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-6 border-white/30 bg-white/10 text-white backdrop-blur-sm">
              <ShieldCheck className="mr-2 h-3.5 w-3.5" />
              Privacy Policy
            </Badge>
            <h1 className="mb-6 font-bold text-4xl leading-tight sm:text-5xl lg:text-6xl">
              Privacy Statement
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-white/85 leading-relaxed">
              BI Student Organization (BISO) is committed to handling your
              personal data in a secure and safe manner. Learn how we protect
              your privacy.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Quick Info Cards */}
        <div className="mb-12 grid gap-4 sm:grid-cols-3">
          <Card className="border-0 bg-linear-to-br from-blue-50 via-blue-50/50 to-white p-5 shadow-lg dark:from-blue-950/30 dark:via-blue-950/10 dark:to-card">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-blue-700">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <h3 className="mb-1 font-semibold text-foreground">
              GDPR Compliant
            </h3>
            <p className="text-muted-foreground text-sm">
              We follow EU data protection regulations
            </p>
          </Card>
          <Card className="border-0 bg-linear-to-br from-emerald-50 via-emerald-50/50 to-white p-5 shadow-lg dark:from-emerald-950/30 dark:via-emerald-950/10 dark:to-card">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-emerald-500 to-emerald-700">
              <Lock className="h-5 w-5 text-white" />
            </div>
            <h3 className="mb-1 font-semibold text-foreground">
              Secure Storage
            </h3>
            <p className="text-muted-foreground text-sm">
              HTTPS encryption for all data transmission
            </p>
          </Card>
          <Card className="border-0 bg-linear-to-br from-violet-50 via-violet-50/50 to-white p-5 shadow-lg dark:from-violet-950/30 dark:via-violet-950/10 dark:to-card">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-violet-500 to-violet-700">
              <UserCheck className="h-5 w-5 text-white" />
            </div>
            <h3 className="mb-1 font-semibold text-foreground">Your Rights</h3>
            <p className="text-muted-foreground text-sm">
              Access, correct, or delete your data anytime
            </p>
          </Card>
        </div>

        {/* Table of Contents */}
        <Card className="mb-12 p-6">
          <h2 className="mb-4 font-semibold text-foreground text-lg">
            Table of Contents
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((section, index) => (
              <a
                className="flex items-center gap-2 rounded-lg p-2 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
                href={`#${section.id}`}
                key={section.id}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted font-medium text-foreground text-xs">
                  {index + 1}
                </span>
                <span className="line-clamp-1">{section.title}</span>
              </a>
            ))}
          </div>
        </Card>

        {/* Policy Sections */}
        <Accordion
          className="space-y-4"
          defaultValue={["intro"]}
          type="multiple"
        >
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <AccordionItem
                className="rounded-xl border bg-card px-6 shadow-sm"
                id={section.id}
                key={section.id}
                value={section.id}
              >
                <AccordionTrigger className="py-5 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-left font-semibold text-foreground">
                      {section.title}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-6">
                  <div className="prose prose-sm max-w-none pl-13 text-muted-foreground">
                    {section.content.split("\n\n").map((paragraph, idx) => (
                      <p
                        className="mb-3 last:mb-0 whitespace-pre-line"
                        key={idx}
                      >
                        {paragraph.split("**").map((part, partIdx) =>
                          partIdx % 2 === 1 ? (
                            <strong
                              className="font-semibold text-foreground"
                              key={partIdx}
                            >
                              {part}
                            </strong>
                          ) : (
                            part
                          )
                        )}
                      </p>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {/* Contact Section */}
        <section className="mt-16">
          <Card className="relative overflow-hidden border-0 bg-linear-to-br from-brand-overlay-from via-brand-overlay-via to-brand-overlay-to p-8 text-white shadow-xl sm:p-10">
            <div className="absolute inset-0 bg-linear-to-t from-brand-overlay-from/50 via-transparent to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_50%)]" />
            <div className="relative flex flex-col items-center gap-6 text-center lg:flex-row lg:justify-between lg:text-left">
              <div>
                <h2 className="mb-2 font-bold text-xl text-white sm:text-2xl">
                  Questions about your privacy?
                </h2>
                <p className="max-w-xl text-white/80">
                  If you have any questions about how we handle your personal
                  data or want to exercise your rights, please contact us.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  className="bg-white text-primary shadow-lg hover:bg-white/90"
                  size="lg"
                >
                  <a href="mailto:contact@biso.no">
                    <Mail className="mr-2 h-4 w-4" />
                    contact@biso.no
                  </a>
                </Button>
                <Button
                  asChild
                  className="border-white/30 text-white hover:bg-white/10"
                  size="lg"
                  variant="outline"
                >
                  <Link href="/contact">Contact Page</Link>
                </Button>
              </div>
            </div>
          </Card>
        </section>

        {/* Last Updated */}
        <div className="mt-8 text-center text-muted-foreground text-sm">
          <p>Last updated: December 2024 • Organization number: 987713380</p>
        </div>
      </div>
    </div>
  );
}
