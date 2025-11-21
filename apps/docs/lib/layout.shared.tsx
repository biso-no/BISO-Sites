import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";
import Logo from "public/logo.png";

export function baseOptions(): BaseLayoutProps {
  return {
    links: [
      {
        url: "/docs",
        external: false,
        type: "main",
        text: "Documentation",
      },
      {
        url: "https://github.com/biso-no/biso-sites",
        external: true,
        type: "main",
        text: "Repository",
      },
      {
        url: "https://public.biso.no",
        external: true,
        type: "main",
        text: "Website",
      },
      {
        url: "https://admin-dev.biso.no",
        external: true,
        type: "main",
        text: "Admin",
      },
    ],
    nav: {
      title: (
        <>
          {logo}
          <span className="font-medium in-[.uwu]:hidden in-[header]:text-[15px]">
            BISO
          </span>
        </>
      ),
    },
  };
}

export const logo = (
  <>
    <Image
      alt="Fumadocs"
      src={Logo}
      sizes="100px"
      className="hidden w-22 in-[.uwu]:block"
      aria-label="Fumadocs"
    />
  </>
);
