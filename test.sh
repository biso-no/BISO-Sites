#!/bin/bash

# Change this to 'pnpm remove' or 'yarn remove' if you are not using npm
PKG_MGR="npm uninstall" 

echo "🗑️ Deleting unused files..."
files_to_delete=(
  "apps/admin/src/lib/form-events.ts"
  "apps/admin/src/lib/notifications-helper.ts"
  "apps/admin/src/app/actions/nav-menu.ts"
  "apps/admin/src/app/actions/site-pages.ts"
  "apps/admin/src/components/assistant/use-puck-chat-stream.ts"
  "apps/admin/src/lib/actions/expense.ts"
  "apps/admin/src/lib/actions/update-dashboard-metrics.ts"
  "apps/admin/src/app/(admin)/events/shared/event-preview.tsx"
  "apps/admin/src/app/(admin)/events/shared/image-upload-card.tsx"
  "apps/admin/src/app/(admin)/settings/_components/policy-pages-manager.tsx"
  "apps/admin/src/app/(admin)/shop/products/_components/product-preview.tsx"
  "apps/web/src/components/about/about-content-section.tsx"
  "apps/web/src/components/home/news-client.tsx"
  "apps/web/src/components/shop/cart-page-client.tsx"
  "apps/web/src/lib/actions/expense-ocr.ts"
  "apps/web/src/lib/services/document-processing.ts"
  "apps/web/src/lib/stores/cart.ts"
  "apps/web/src/components/shop/[id]/page.tsx"
  "apps/web/src/app/(protected)/fs/new/new-expense-client.tsx"
  "packages/editor/src/puck-augments.ts"
  "apps/docs/next.config.source.ts"
  "apps/docs/components/mdx.tsx"
  "packages/connectors/src/woocommerce/migrate-products.ts"
)

for file in "${files_to_delete[@]}"; do
  if [ -f "$file" ]; then
    rm "$file"
    echo "Deleted: $file"
  else
    echo "Skipped (not found): $file"
  fi
done

echo "📦 Removing unused dependencies..."

echo "> apps/admin..."
cd apps/admin && $PKG_MGR @json-render/react @minoru/react-dnd-treeview @tanstack/react-form-nextjs @tanstack/zod-form-adapter react-dnd react-dnd-html5-backend baseline-browser-mapping && cd ../..

echo "> apps/api..."
cd apps/api && $PKG_MGR @azure/msal-node @pinecone-database/pinecone gpt-tokenizer jszip mammoth pdfjs-dist turndown uuid xlsx xml2js @types/turndown @types/xml2js && cd ../..

echo "> apps/web..."
cd apps/web && $PKG_MGR @azure/msal-node @microsoft/microsoft-graph-client @tanstack/react-form @tanstack/react-form-nextjs gpt-tokenizer jszip pdfjs-dist turndown xlsx xml2js @types/turndown @types/xml2js && cd ../..

echo "> packages/ai..."
cd packages/ai && $PKG_MGR @azure/msal-node @microsoft/microsoft-graph-client @repo/typescript-config && cd ../..

echo "> packages/editor..."
cd packages/editor && $PKG_MGR @json-render/react server-only && cd ../..

echo "> packages/ui..."
cd packages/ui && $PKG_MGR dedent radix-ui && cd ../..

echo "> packages/payment..."
cd packages/payment && $PKG_MGR @repo/typescript-config && cd ../..

echo "> packages/shared..."
cd packages/shared && $PKG_MGR @repo/typescript-config && cd ../..

echo "> packages/connectors..."
cd packages/connectors && $PKG_MGR @repo/typescript-config && cd ../..

echo "> packages/api..."
cd packages/api && $PKG_MGR @repo/connectors @repo/typescript-config && cd ../..

echo "✅ File and dependency cleanup complete!"