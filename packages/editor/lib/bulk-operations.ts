import { transformProps, walkTree } from "@measured/puck";
import type { PageBuilderDocument } from "../types";
import { pageBuilderConfig } from "../page-builder-config";

/**
 * Bulk operation utilities for modifying multiple components at once
 */

/**
 * Update all components of a specific type
 */
export function updateComponentsByType<T = any>(
  data: PageBuilderDocument,
  componentType: string,
  updater: (props: T) => Partial<T>
): PageBuilderDocument {
  return transformProps(data, {
    [componentType]: (props) => ({
      ...props,
      ...updater(props as T),
    }),
  });
}

/**
 * Update all image URLs (useful for migrating storage buckets)
 */
export function updateAllImageUrls(
  data: PageBuilderDocument,
  urlTransformer: (url: string) => string
): PageBuilderDocument {
  return walkTree(data, pageBuilderConfig, (component) => {
    const props = { ...component.props };

    // Handle backgroundImage in Hero, Section, CTA
    if (props.backgroundImage?.url) {
      props.backgroundImage = {
        ...props.backgroundImage,
        url: urlTransformer(props.backgroundImage.url),
      };
    }

    // Handle image in Image block
    if (props.image?.url) {
      props.image = {
        ...props.image,
        url: urlTransformer(props.image.url),
      };
    }

    // Handle avatar in Testimonial
    if (props.avatar?.url) {
      props.avatar = {
        ...props.avatar,
        url: urlTransformer(props.avatar.url),
      };
    }

    // Handle arrays with images (cards, members, logos)
    if (Array.isArray(props.cards)) {
      props.cards = props.cards.map((card: any) => ({
        ...card,
        image: card.image?.url
          ? { ...card.image, url: urlTransformer(card.image.url) }
          : card.image,
      }));
    }

    if (Array.isArray(props.members)) {
      props.members = props.members.map((member: any) => ({
        ...member,
        photo: member.photo?.url
          ? { ...member.photo, url: urlTransformer(member.photo.url) }
          : member.photo,
      }));
    }

    if (Array.isArray(props.logos)) {
      props.logos = props.logos.map((logo: any) => ({
        ...logo,
        logo: logo.logo?.url
          ? { ...logo.logo, url: urlTransformer(logo.logo.url) }
          : logo.logo,
      }));
    }

    return { ...component, props };
  });
}

/**
 * Convert all manual data sources to database mode
 * (useful for bulk migration)
 */
export function convertToDatabase(
  data: PageBuilderDocument,
  componentType: string,
  config: {
    collection: string;
    query?: any;
    fieldMapping?: Record<string, string>;
  }
): PageBuilderDocument {
  return transformProps(data, {
    [componentType]: (props) => ({
      ...props,
      dataSource: "database",
      collection: config.collection,
      query: config.query,
      fieldMapping: config.fieldMapping,
    }),
  });
}

/**
 * Reset all database sources to manual mode
 */
export function resetToManual(
  data: PageBuilderDocument,
  componentType: string
): PageBuilderDocument {
  return transformProps(data, {
    [componentType]: (props) => ({
      ...props,
      dataSource: "manual",
      collection: undefined,
      query: undefined,
      fieldMapping: undefined,
    }),
  });
}

/**
 * Update all links to a new domain
 */
export function updateAllLinks(
  data: PageBuilderDocument,
  oldDomain: string,
  newDomain: string
): PageBuilderDocument {
  return walkTree(data, pageBuilderConfig, (component) => {
    const props = { ...component.props };

    // Update href fields
    if (typeof props.href === "string" && props.href.includes(oldDomain)) {
      props.href = props.href.replace(oldDomain, newDomain);
    }

    if (typeof props.link === "string" && props.link.includes(oldDomain)) {
      props.link = props.link.replace(oldDomain, newDomain);
    }

    // Update button hrefs
    if (
      typeof props.primaryButtonHref === "string" &&
      props.primaryButtonHref.includes(oldDomain)
    ) {
      props.primaryButtonHref = props.primaryButtonHref.replace(
        oldDomain,
        newDomain
      );
    }

    if (
      typeof props.secondaryButtonHref === "string" &&
      props.secondaryButtonHref.includes(oldDomain)
    ) {
      props.secondaryButtonHref = props.secondaryButtonHref.replace(
        oldDomain,
        newDomain
      );
    }

    if (
      typeof props.buttonHref === "string" &&
      props.buttonHref.includes(oldDomain)
    ) {
      props.buttonHref = props.buttonHref.replace(oldDomain, newDomain);
    }

    // Update arrays with links
    if (Array.isArray(props.cards)) {
      props.cards = props.cards.map((card: any) => ({
        ...card,
        link:
          typeof card.link === "string" && card.link.includes(oldDomain)
            ? card.link.replace(oldDomain, newDomain)
            : card.link,
      }));
    }

    return { ...component, props };
  });
}

/**
 * Update all gradient presets
 */
export function updateGradients(
  data: PageBuilderDocument,
  oldGradient: string,
  newGradient: string
): PageBuilderDocument {
  return walkTree(data, pageBuilderConfig, (component) => {
    const props = { ...component.props };

    if (props.backgroundGradient === oldGradient) {
      props.backgroundGradient = newGradient;
    }

    if (props.gradient === oldGradient) {
      props.gradient = newGradient;
    }

    // Handle arrays with gradients (stats, features)
    if (Array.isArray(props.stats)) {
      props.stats = props.stats.map((stat: any) => ({
        ...stat,
        gradient: stat.gradient === oldGradient ? newGradient : stat.gradient,
      }));
    }

    return { ...component, props };
  });
}

/**
 * Count components by type
 */
export function countComponentsByType(
  data: PageBuilderDocument
): Record<string, number> {
  const counts: Record<string, number> = {};

  walkTree(data, pageBuilderConfig, (component) => {
    counts[component.type] = (counts[component.type] || 0) + 1;
    return component;
  });

  return counts;
}

/**
 * Find all components matching a condition
 */
export function findComponents(
  data: PageBuilderDocument,
  predicate: (component: any) => boolean
): any[] {
  const matches: any[] = [];

  walkTree(data, pageBuilderConfig, (component) => {
    if (predicate(component)) {
      matches.push(component);
    }
    return component;
  });

  return matches;
}

/**
 * Remove all components of a specific type
 */
export function removeComponentsByType(
  data: PageBuilderDocument,
  componentType: string
): PageBuilderDocument {
  const newData = { ...data };

  newData.content = newData.content.filter(
    (item) => item.type !== componentType
  );

  // Also clean zones if present
  if (newData.zones) {
    Object.keys(newData.zones).forEach((zoneKey) => {
      newData.zones[zoneKey] = newData.zones[zoneKey].filter(
        (item) => item.type !== componentType
      );
    });
  }

  return newData;
}

/**
 * Duplicate all components of a specific type
 */
export function duplicateComponentsByType(
  data: PageBuilderDocument,
  componentType: string
): PageBuilderDocument {
  const newData = { ...data };
  const toDuplicate: any[] = [];

  newData.content.forEach((item) => {
    if (item.type === componentType) {
      toDuplicate.push({
        ...item,
        props: {
          ...item.props,
          id: `${item.props.id}-copy`,
        },
      });
    }
  });

  newData.content = [...newData.content, ...toDuplicate];

  return newData;
}

/**
 * Export bulk operations
 */
export const bulkOperations = {
  updateComponentsByType,
  updateAllImageUrls,
  convertToDatabase,
  resetToManual,
  updateAllLinks,
  updateGradients,
  countComponentsByType,
  findComponents,
  removeComponentsByType,
  duplicateComponentsByType,
};

