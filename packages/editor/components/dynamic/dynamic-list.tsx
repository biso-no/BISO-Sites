import { EnhancedComponentConfig } from "../../types";
import { applyStyles } from "../../lib/style-engine";
import { fetchData, createDataSource } from "../../lib/data-sources";

interface DynamicListProps {
  dataSourceType?: "static" | "api" | "appwrite";
  apiUrl?: string;
  databaseId?: string;
  collectionId?: string;
  staticData?: string; // JSON string
  itemTemplate?: "simple" | "card" | "custom";
  titleField?: string;
  descriptionField?: string;
  imageField?: string;
  limit?: number;
  
  // Styling
  gap?: string;
  paddingTop?: string;
  paddingBottom?: string;
  className?: string;
}

export const PuckDynamicList: EnhancedComponentConfig<DynamicListProps> = {
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
    itemTemplate: {
      type: "select",
      label: "Item Template",
      options: [
        { label: "Simple", value: "simple" },
        { label: "Card", value: "card" },
        { label: "Custom", value: "custom" },
      ],
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
    limit: {
      type: "number",
      label: "Number of Items to Display",
      min: 1,
      max: 100,
    },
    // Spacing
    gap: {
      type: "select",
      label: "Gap Between Items",
      options: [
        { label: "2", value: "2" },
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
      { title: "Item 1", description: "Description for item 1" },
      { title: "Item 2", description: "Description for item 2" },
      { title: "Item 3", description: "Description for item 3" },
    ], null, 2),
    itemTemplate: "simple",
    titleField: "title",
    descriptionField: "description",
    imageField: "image",
    limit: 10,
    gap: "4",
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
      itemTemplate,
      titleField = "title",
      descriptionField = "description",
      imageField = "image",
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
        <div className={`space-y-${gap}`}>
          {items.map((item: any, index: number) => {
            const title = item[titleField];
            const description = item[descriptionField];
            const image = item[imageField];

            if (itemTemplate === "card") {
              return (
                <div key={index} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
                  {image && (
                    <img
                      src={image}
                      alt={title || ""}
                      className="w-full h-48 object-cover rounded-md mb-4"
                    />
                  )}
                  <h3 className="text-xl font-semibold mb-2">{title}</h3>
                  {description && <p className="text-muted-foreground">{description}</p>}
                </div>
              );
            }

            // Simple template
            return (
              <div key={index} className="py-4 border-b last:border-0">
                <h4 className="font-medium mb-1">{title}</h4>
                {description && (
                  <p className="text-sm text-muted-foreground">{description}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  },
};

