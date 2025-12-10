import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
 Card,
 CardContent,
 CardHeader,
 CardTitle,
} from "@repo/ui/components/ui/card";
import {
 Building2,
 Calendar,
 Handshake,
 Heart,
 Mail,
 MapPin,
 MessageSquare,
 Phone,
 Presentation,
 Target,
 Users,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
 const t = await getTranslations("partner.meta");

 return {
 title: t("title"),
 description: t("description"),
 };
}

export default function PartnerPage() {
 const t = useTranslations("partner");

 const benefits = [
 {
 key: "colleagues",
 icon: Users,
 title: t("benefits.items.colleagues.title"),
 description: t("benefits.items.colleagues.description"),
 },
 {
 key: "values",
 icon: Heart,
 title: t("benefits.items.values.title"),
 description: t("benefits.items.values.description"),
 },
 {
 key: "match",
 icon: Target,
 title: t("benefits.items.match.title"),
 description: t("benefits.items.match.description"),
 },
 ];

 const careerDays = [
 {
 key: "oslo",
 city: "Oslo",
 title: t("careerDays.cities.oslo.title"),
 action: t("careerDays.cities.oslo.action"),
 },
 {
 key: "bergen",
 city: "Bergen",
 title: t("careerDays.cities.bergen.title"),
 action: t("careerDays.cities.bergen.action"),
 },
 {
 key: "trondheim",
 city: "Trondheim",
 title: t("careerDays.cities.trondheim.title"),
 action: t("careerDays.cities.trondheim.action"),
 },
 {
 key: "stavanger",
 city: "Stavanger",
 title: t("careerDays.cities.stavanger.title"),
 action: t("careerDays.cities.stavanger.action"),
 },
 ];

 const campuses = [
 {
 key: "oslo",
 title: t("contact.campuses.oslo.title"),
 phone: t("contact.campuses.oslo.phone"),
 email: t("contact.campuses.oslo.email"),
 address: t("contact.campuses.oslo.address"),
 },
 {
 key: "bergen",
 title: t("contact.campuses.bergen.title"),
 phone: t("contact.campuses.bergen.phone"),
 email: t("contact.campuses.bergen.email"),
 address: t("contact.campuses.bergen.address"),
 },
 {
 key: "trondheim",
 title: t("contact.campuses.trondheim.title"),
 phone: t("contact.campuses.trondheim.phone"),
 email: t("contact.campuses.trondheim.email"),
 address: t("contact.campuses.trondheim.address"),
 },
 {
 key: "stavanger",
 title: t("contact.campuses.stavanger.title"),
 phone: t("contact.campuses.stavanger.phone"),
 email: t("contact.campuses.stavanger.email"),
 address: t("contact.campuses.stavanger.address"),
 },
 ];

 const businessHotspotFeatures = [
 {
 key: "present",
 icon: Presentation,
 text: t("opportunities.businessHotspot.features.present"),
 },
 {
 key: "presentations",
 icon: Building2,
 text: t("opportunities.businessHotspot.features.presentations"),
 },
 {
 key: "talk",
 icon: MessageSquare,
 text: t("opportunities.businessHotspot.features.talk"),
 },
 {
 key: "stand",
 icon: Building2,
 text: t("opportunities.businessHotspot.features.stand"),
 },
 {
 key: "relationship",
 icon: Heart,
 text: t("opportunities.businessHotspot.features.relationship"),
 },
 {
 key: "agreements",
 icon: Handshake,
 text: t("opportunities.businessHotspot.features.agreements"),
 },
 ];

 return (
 <div className="min-h-screen">
 {/* Hero Section */}
 <section className="relative overflow-hidden bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-card dark:via-card dark:to-card">
 <div className="mask-[linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:mask-[linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))] absolute inset-0 bg-grid-slate-100 dark:bg-grid-slate-700/25" />
 <div className="relative">
 <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:flex lg:items-center lg:gap-x-10 lg:px-8 lg:py-40">
 <div className="mx-auto max-w-2xl lg:mx-0 lg:flex-auto">
 <div className="flex">
 <Badge className="mb-6 font-medium text-sm" variant="secondary">
 {t("hero.subtitle")}
 </Badge>
 </div>
 <h1 className="mt-10 max-w-lg font-bold text-4xl text-foreground tracking-tight sm:text-6xl dark:text-white">
 {t("hero.title")}
 </h1>
 <p className="mt-6 text-muted-foreground text-lg leading-8 dark:text-muted-foreground">
 {t("hero.description")}
 </p>
 <div className="mt-10 flex items-center gap-x-6">
 <Button
 asChild
 className="bg-blue-600 hover:bg-blue-700"
 size="lg"
 >
 <Link href="/contact">
 <Mail className="mr-2 h-4 w-4" />
 {t("buttons.contact")}
 </Link>
 </Button>
 <Button asChild size="lg" variant="outline">
 <Link href="#benefits">{t("buttons.readMore")}</Link>
 </Button>
 </div>
 </div>
 <div className="mt-16 sm:mt-24 lg:mt-0 lg:shrink-0 lg:grow">
 <div className="mx-auto w-91.5 max-w-full lg:mx-0">
 <Image
 alt="Partnership illustration"
 className="w-full rounded-2xl shadow-2xl ring-1 ring-gray-400/10"
 height={366}
 priority
 src="/images/bedrift.png"
 width={366}
 />
 </div>
 </div>
 </div>
 </div>
 </section>

 {/* Benefits Section */}
 <section className="py-24 sm:py-32">
 <div className="mx-auto max-w-7xl px-6 lg:px-8">
 <div className="mx-auto max-w-2xl text-center">
 <h2 className="font-bold text-3xl text-foreground tracking-tight sm:text-4xl dark:text-white">
 {t("benefits.title")}
 </h2>
 <p className="mt-6 text-muted-foreground text-lg leading-8 dark:text-muted-foreground">
 {t("benefits.subtitle")}
 </p>
 </div>
 <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
 <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
 {benefits.map((benefit) => {
 const Icon = benefit.icon;
 return (
 <div className="flex flex-col" key={benefit.key}>
 <dt className="flex items-center gap-x-3 font-semibold text-base text-foreground leading-7 dark:text-white">
 <Icon
 aria-hidden="true"
 className="h-5 w-5 flex-none text-primary"
 />
 {benefit.title}
 </dt>
 <dd className="mt-4 flex flex-auto flex-col text-base text-muted-foreground leading-7 dark:text-muted-foreground">
 <p className="flex-auto">{benefit.description}</p>
 </dd>
 </div>
 );
 })}
 </dl>
 </div>
 </div>
 </section>

 {/* Career Days Section */}
 <section className="bg-section py-24 sm:py-32 dark:bg-inverted">
 <div className="mx-auto max-w-7xl px-6 lg:px-8">
 <div className="mx-auto max-w-2xl text-center">
 <h2 className="font-bold text-3xl text-foreground tracking-tight sm:text-4xl dark:text-white">
 {t("careerDays.title")}
 </h2>
 <p className="mt-6 text-muted-foreground text-lg leading-8 dark:text-muted-foreground">
 {t("careerDays.description")}
 </p>
 </div>
 <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-6 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-2 xl:grid-cols-4">
 {careerDays.map((career) => (
 <Card
 className="transition-shadow hover:shadow-lg"
 key={career.key}
 >
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Calendar className="h-5 w-5 text-primary" />
 {career.title}
 </CardTitle>
 </CardHeader>
 <CardContent>
 <Button className="w-full bg-blue-600 hover:bg-blue-700">
 {career.action}
 </Button>
 </CardContent>
 </Card>
 ))}
 </div>
 </div>
 </section>

 {/* Business Hotspot Section - Only for Oslo */}
 <section className="py-24 sm:py-32">
 <div className="mx-auto max-w-7xl px-6 lg:px-8">
 <div className="mx-auto max-w-2xl text-center">
 <Badge className="mb-4" variant="secondary">
 {t("opportunities.title")}
 </Badge>
 <h2 className="font-bold text-3xl text-foreground tracking-tight sm:text-4xl dark:text-white">
 {t("opportunities.businessHotspot.title")}
 </h2>
 <p className="mt-6 text-muted-foreground text-lg leading-8 dark:text-muted-foreground">
 {t("opportunities.businessHotspot.description")}
 </p>
 </div>

 <div className="mx-auto mt-16 lg:mx-0 lg:max-w-none">
 <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
 <div>
 <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
 {businessHotspotFeatures.map((feature) => {
 const Icon = feature.icon;
 return (
 <div
 className="flex items-center gap-3 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20"
 key={feature.key}
 >
 <Icon className="h-5 w-5 text-primary" />
 <span className="font-medium text-foreground text-sm dark:text-white">
 {feature.text}
 </span>
 </div>
 );
 })}
 </div>
 <div className="text-center lg:text-left">
 <h3 className="mb-2 font-bold text-2xl text-foreground dark:text-white">
 {t("opportunities.businessHotspot.concept.title")}
 </h3>
 <p className="mb-6 font-semibold text-primary text-xl">
 {t("opportunities.businessHotspot.concept.subtitle")}
 </p>
 <Button className="bg-blue-600 hover:bg-blue-700" size="lg">
 {t("buttons.readMore")}
 </Button>
 </div>
 </div>
 <div className="relative">
 <Image
 alt="Business Hotspot"
 className="w-full rounded-2xl shadow-2xl"
 height={400}
 src="/images/business-hotspot.png"
 width={600}
 />
 <div className="absolute top-4 right-4">
 <Badge className="bg-orange-500 hover:bg-orange-600">
 Oslo Only
 </Badge>
 </div>
 </div>
 </div>
 </div>
 </div>
 </section>

 {/* Contact Section */}
 <section className="bg-section py-24 sm:py-32 dark:bg-inverted">
 <div className="mx-auto max-w-7xl px-6 lg:px-8">
 <div className="mx-auto max-w-2xl text-center">
 <h2 className="font-bold text-3xl text-foreground tracking-tight sm:text-4xl dark:text-white">
 {t("contact.title")}
 </h2>
 <p className="mt-6 text-muted-foreground text-lg leading-8 dark:text-muted-foreground">
 {t("contact.description")}
 </p>
 </div>
 <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-6 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-2 xl:grid-cols-4">
 {campuses.map((campus) => (
 <Card
 className="transition-shadow hover:shadow-lg"
 key={campus.key}
 >
 <CardHeader>
 <CardTitle className="text-center">{campus.title}</CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="flex items-center gap-3 text-sm">
 <Phone className="h-4 w-4 shrink-0 text-primary" />
 <span className="text-muted-foreground dark:text-muted-foreground">
 {campus.phone}
 </span>
 </div>
 <div className="flex items-center gap-3 text-sm">
 <Mail className="h-4 w-4 shrink-0 text-primary" />
 <Link
 className="text-primary underline hover:text-blue-700"
 href={`mailto:${campus.email}`}
 >
 {campus.email}
 </Link>
 </div>
 <div className="flex items-start gap-3 text-sm">
 <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
 <span className="text-muted-foreground dark:text-muted-foreground">
 {campus.address}
 </span>
 </div>
 <Button className="mt-4 w-full bg-blue-600 hover:bg-blue-700">
 <Mail className="mr-2 h-4 w-4" />
 {t("buttons.contact")}
 </Button>
 </CardContent>
 </Card>
 ))}
 </div>
 </div>
 </section>
 </div>
 );
}
