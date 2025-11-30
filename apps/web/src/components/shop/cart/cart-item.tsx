"use client";

import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Minus, Plus, Trash2, Users } from "lucide-react";
import type { CartItem as CartItemType } from "@/lib/contexts/cart-context";

type CartItemProps = {
  item: CartItemType;
  isMember: boolean;
  onUpdateQuantity: (id: string, amount: number) => void;
  onRemove: (id: string) => void;
};

const categoryColors: Record<string, string> = {
  Merch: "bg-purple-100 text-purple-700 border-purple-200",
  Trips: "bg-blue-100 text-blue-700 border-blue-200",
  Lockers: "bg-green-100 text-green-700 border-green-200",
  Membership: "bg-orange-100 text-orange-700 border-orange-200",
};

function QuantityControl({
  quantity,
  stock,
  maxPerOrder,
  onIncrease,
  onDecrease,
}: {
  quantity: number;
  stock: number | null;
  maxPerOrder?: number;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  const isMaxReached =
    (stock !== null && quantity >= stock) ||
    (maxPerOrder !== undefined && quantity >= maxPerOrder);

  return (
    <div className="flex items-center gap-3">
      <span className="text-gray-600 text-sm">Quantity:</span>
      <div className="flex items-center gap-2 rounded-lg border border-gray-300">
        <Button
          className="h-8 w-8 p-0 disabled:opacity-50"
          disabled={quantity <= 1}
          onClick={onDecrease}
          size="sm"
          variant="ghost"
        >
          <Minus className="h-4 w-4 text-gray-900 hover:text-blue-800" />
        </Button>
        <span className="w-8 text-center font-medium text-gray-900">
          {quantity}
        </span>
        <Button
          className="h-8 w-8 p-0 disabled:opacity-50"
          disabled={isMaxReached}
          onClick={onIncrease}
          size="sm"
          variant="ghost"
        >
          <Plus className="h-4 w-4 text-gray-900 hover:text-blue-800" />
        </Button>
      </div>
      {stock !== null && stock <= 10 && (
        <span className="text-orange-600 text-xs">Only {stock} available</span>
      )}
      {maxPerOrder && quantity >= maxPerOrder && (
        <span className="text-red-600 text-xs">
          Max {maxPerOrder} per order
        </span>
      )}
    </div>
  );
}

function PriceDisplay({
  regularPrice,
  memberPrice,
  quantity,
  isMember,
}: {
  regularPrice: number;
  memberPrice: number | null;
  quantity: number;
  isMember: boolean;
}) {
  const itemPrice = isMember && memberPrice ? memberPrice : regularPrice;
  const itemTotal = itemPrice * quantity;
  const hasDiscount = isMember && memberPrice && memberPrice < regularPrice;
  const savings = hasDiscount
    ? (regularPrice - (memberPrice ?? 0)) * quantity
    : 0;

  return (
    <div className="text-right">
      {hasDiscount ? (
        <div>
          <div className="text-gray-400 text-sm line-through">
            {regularPrice * quantity} NOK
          </div>
          <div className="font-bold text-[#3DA9E0]">{itemTotal} NOK</div>
          <div className="text-green-600 text-xs">Save {savings} NOK</div>
        </div>
      ) : (
        <div className="font-bold text-gray-900">{itemTotal} NOK</div>
      )}
      {!isMember && memberPrice && memberPrice < regularPrice && (
        <div className="mt-1 text-gray-500 text-xs">
          Members: {memberPrice * quantity} NOK
        </div>
      )}
    </div>
  );
}

export function CartItem({
  item,
  isMember,
  onUpdateQuantity,
  onRemove,
}: CartItemProps) {
  return (
    <Card className="border-0 p-6 shadow-lg">
      <div className="flex gap-6">
        {/* Product Image */}
        <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-lg">
          <ImageWithFallback
            alt={item.name}
            className="object-cover"
            fill
            src={
              item.image ||
              "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1080"
            }
          />
          <Badge
            className={`absolute top-2 left-2 ${categoryColors[item.category] || "bg-gray-100 text-gray-700"}`}
          >
            {item.category}
          </Badge>
        </div>

        {/* Product Details */}
        <div className="grow">
          <div className="mb-2 flex items-start justify-between">
            <div>
              <h3 className="mb-1 font-semibold text-gray-900">{item.name}</h3>
              {item.memberOnly && (
                <Badge className="mb-2 border-0 bg-orange-500 text-white">
                  <Users className="mr-1 h-3 w-3" />
                  Members Only
                </Badge>
              )}
            </div>
            <Button
              className="text-red-500 hover:bg-red-50 hover:text-red-700"
              onClick={() => onRemove(item.id)}
              size="sm"
              variant="ghost"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Selected Options */}
          {item.selectedOptions &&
            Object.keys(item.selectedOptions).length > 0 && (
              <div className="mb-3 rounded-lg bg-gray-50 p-3">
                <p className="mb-1 text-gray-500 text-sm">Selected options:</p>
                {Object.entries(item.selectedOptions).map(([key, value]) => (
                  <p className="text-gray-700 text-sm" key={key}>
                    <strong>{key}:</strong> {value}
                  </p>
                ))}
              </div>
            )}

          {/* Price and Quantity */}
          <div className="mt-4 flex items-center justify-between">
            <QuantityControl
              maxPerOrder={item.metadata?.max_per_order}
              onDecrease={() => onUpdateQuantity(item.id, -1)}
              onIncrease={() => onUpdateQuantity(item.id, 1)}
              quantity={item.quantity}
              stock={item.stock}
            />

            <PriceDisplay
              isMember={isMember}
              memberPrice={item.memberPrice}
              quantity={item.quantity}
              regularPrice={item.regularPrice}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
