import { BenefitBoardPage } from "../_components/benefit-board-page";

type SearchParams = Record<string, string | string[] | undefined>;

const single = (value: string | string[] | undefined): string | undefined =>
  typeof value === "string" ? value : undefined;

/**
 * `/benefits/<id>` and `/benefits/new` show the board with the benefit open
 * in the side panel, so links from the assistant, approvals and old
 * bookmarks land on the same screen as a click on the board.
 */
export default async function BenefitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return (
    <BenefitBoardPage
      campus={single(query.campus)}
      newPartnerId={single(query.partner)}
      newSection={single(query.section)}
      openId={id}
    />
  );
}
