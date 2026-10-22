import { BenefitBoardPage } from "./_components/benefit-board-page";

export default async function BenefitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { campus } = await searchParams;
  return (
    <BenefitBoardPage
      campus={typeof campus === "string" ? campus : undefined}
    />
  );
}
