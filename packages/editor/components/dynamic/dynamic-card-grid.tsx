import { EnhancedComponentConfig } from "../../types";
import { applyStyles } from "../../lib/style-engine";
import { fetchData, createDataSource } from "../../lib/data-sources";

interface DynamicCardGridProps {
  dataSourceType?: "static" | "api" | "appwrite";
  apiUrl?: string;
  databaseId?: string;
  collectionId?: string;
  staticData?: string; // JSON string
  titleField?: string;
  descriptionField?: string;
  imageField?: string;
  linkField?: string;
  columns?: "2" | "3" | "4";
  limit?: number;
  
  // Styling
  gap?: string;
  paddingTop?: string;
  paddingBottom?: string;
  className?: string;
}

export const PuckDynamicCardGrid: EnhancedComponentConfig<DynamicCardGridProps> = {
  category: "Dynamic Content",
  dataBinding: true,
  fields: {
    dataSourceType: {
      type: "select",
      label: "Data Source Type",
      options: [
        { label: "Static (JSON)", value: "static" },
        { label: "API", value: "api" },
        { label: "Appwrite Collection", value: "appwrite" },
      ],
    },
    apiUrl: {
      type: "text",
      label: "API URL",
    },
    databaseId: {
      type: "text",
      label: "Database ID (Appwrite)",
    },
    collectionId: {
      type: "text",
      label: "Collection ID (Appwrite)",
    },
    staticData: {
      type: "textarea",
      label: "Static Data (JSON Array)",
    },
    titleField: {
      type: "text",
      label: "Title Field Name",
    },
    descriptionField: {
      type: "text",
      label: "Description Field Name",
    },
    imageField: {
      type: "text",
      label: "Image Field Name",
    },
    linkField: {
      type: "text",
      label: "Link Field Name",
    },
    columns: {
      type: "select",
      label: "Columns",
      options: [
        { label: "2", value: "2" },
        { label: "3", value: "3" },
        { label: "4", value: "4" },
      ],
    },
    limit: {
      type: "number",
      label: "Number of Cards to Display",
      min: 1,
      max: 100,
    },
    // Spacing
    gap: {
      type: "select",
      label: "Gap Between Cards",
      options: [
        { label: "4", value: "4" },
        { label: "6", value: "6" },
        { label: "8", value: "8" },
      ],
    },
    paddingTop: { type: "text", label: "Padding Top" },
    paddingBottom: { type: "text", label: "Padding Bottom" },
    className: { type: "text", label: "Custom Classes" },
  },
  defaultProps: {
    dataSourceType: "static",
    staticData: JSON.stringify([
      {
        title: "Product 1",
        description: "Amazing product that will change your life",
        image: "https://via.placeholder.com/400x300",
        link: "#",
      },
      {
        title: "Product 2",
        description: "Another great product you'll love",
        image: "https://via.placeholder.com/400x300",
        link: "#",
      },
      {
        title: "Product 3",
        description: "The best product in the market",
        image: "https://via.placeholder.com/400x300",
        link: "#",
      },
    ], null, 2),
    titleField: "title",
    descriptionField: "description",
    imageField: "image",
    linkField: "link",
    columns: "3",
    limit: 12,
    gap: "6",
  },
  resolveData: async (props) => {
    const { dataSourceType, apiUrl, databaseId, collectionId, staticData, limit } = props;

    let dataSource;
    
    switch (dataSourceType) {
      case "api":
        if (!apiUrl) return { items: [] };
        dataSource = createDataSource.api(apiUrl);
        break;
      case "appwrite":
        if (!databaseId || !collectionId) return { items: [] };
        dataSource = createDataSource.appwrite(databaseId, collectionId);
        break;
      case "static":
      default:
        try {
          const parsedData = staticData ? JSON.parse(staticData) : [];
          dataSource = createDataSource.static(Array.isArray(parsedData) ? parsedData : [parsedData]);
        } catch (e) {
          console.error("Failed to parse static data:", e);
          return { items: [] };
        }
    }

    try {
      let items = await fetchData(dataSource, { cache: true });
      if (limit) {
        items = items.slice(0, limit);
      }
      return { items };
    } catch (error) {
      console.error("Error fetching data:", error);
      return { items: [] };
    }
  },
  render: (props) => {
    const {
      items = [],
      titleField = "title",
      descriptionField = "description",
      imageField = "image",
      linkField = "link",
      columns,
      gap,
      paddingTop,
      paddingBottom,
      className: customClassName,
    } = props as any;

    const { className, style } = applyStyles({
      paddingTop,
      paddingBottom,
      className: customClassName,
    });

    if (!items || items.length === 0) {
      return (
        <div className={className} style={style}>
          <p className="text-muted-foreground">No items to display. Configure your data source.</p>
        </div>
      );
    }

    return (
      <div className={className} style={style}>
        <div className={`grid grid-cols-1 md:grid-cols-${columns} gap-${gap}`}>
          {items.map((item: any, index: number) => {
            const title = item[titleField];
            const description = item[descriptionField];
            const image = item[imageField];
            const link = item[linkField];

            const CardWrapper = link ? "a" : "div";
            const cardProps = link ? { href: link } : {};

            return (
              <CardWrapper
                key={index}
                {...cardProps}
                className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow bg-card"
              >
                {image && (
                  <div className="aspect-video w-full overflow-hidden">
                    <img
                      src={image}
                      alt={title || ""}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="p-6">
                  <h3 className="text-xl font-semibold mb-2">{title}</h3>
                  {description && (
                    <p className="text-muted-foreground">{description}</p>
                  )}
                </div>
              </CardWrapper>
            );
          })}
        </div>
      </div>
    );
  },
};

