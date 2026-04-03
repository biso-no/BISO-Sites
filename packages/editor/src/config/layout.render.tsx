import { Columns, type ColumnsProps } from "@repo/ui/components/puck/columns";
import { Section } from "@repo/ui/components/puck/section";
import { Spacer, type SpacerProps } from "@repo/ui/components/puck/spacer";
import { Tabs, type TabsProps } from "@repo/ui/components/puck/tabs";
import type {
  ColumnsPropsWithSlots,
  SectionPropsWithSlot,
  TabsPropsWithSlots,
} from "./types";

export function SectionRender({
  content: Content,
  ...props
}: SectionPropsWithSlot) {
  return <Section {...props}>{Content && <Content />}</Section>;
}

export function ColumnsRender({
  "col-0": Col0,
  "col-1": Col1,
  "col-2": Col2,
  layout = "1:1",
  ...props
}: ColumnsPropsWithSlots) {
  const colCount = layout.split(":").length;
  return (
    <Columns layout={layout} {...(props as ColumnsProps)}>
      {Col0 && <Col0 />}
      {Col1 && <Col1 />}
      {colCount > 2 && Col2 && <Col2 />}
    </Columns>
  );
}

export function SpacerRender(props: SpacerProps) {
  return <Spacer {...props} />;
}

export function TabsRender({
  tab0: Tab0,
  tab1: Tab1,
  tab2: Tab2,
  tab3: Tab3,
  tabs,
  ...props
}: TabsPropsWithSlots) {
  return (
    <Tabs
      {...(props as TabsProps)}
      tab0={Tab0 && <Tab0 />}
      tab1={Tab1 && <Tab1 />}
      tab2={Tab2 && <Tab2 />}
      tab3={Tab3 && <Tab3 />}
      tabs={tabs}
    />
  );
}
