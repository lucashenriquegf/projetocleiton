'use client';

import { PackageSearch, Send } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { Button } from '@/components/ui/button';
import {
  findMenuProduct,
  menuProducts,
  type MenuProduct,
} from '@/lib/mocks/menus';

export function ProductCombobox({
  id,
  value,
  excludedProductIds = [],
  onValueChange,
  onRequestProduct,
  placeholder = 'Buscar produto...',
}: {
  id: string;
  value: string;
  excludedProductIds?: string[];
  onValueChange: (product: MenuProduct) => void;
  onRequestProduct: (suggestedName: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const selectedProduct = findMenuProduct(value) ?? null;
  const availableProducts = useMemo(
    () =>
      menuProducts.filter(
        (product) =>
          product.active &&
          (product.id === value || !excludedProductIds.includes(product.id)),
      ),
    [excludedProductIds, value],
  );

  return (
    <div>
      <ComboboxTape
        id={id}
        products={availableProducts}
        value={selectedProduct}
        query={query}
        placeholder={placeholder}
        onQueryChange={setQuery}
        onValueChange={(product) => {
          if (!product) return;
          setQuery('');
          onValueChange(product);
        }}
        onRequestProduct={() => {
          const suggestedName = query.trim();
          if (!suggestedName) return;
          onRequestProduct(suggestedName);
        }}
      />
      {selectedProduct ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {selectedProduct.category}
          </span>
          <span aria-hidden="true">·</span>
          Unidade: {selectedProduct.unit}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Escolha um item do catálogo. A unidade será preenchida
          automaticamente.
        </p>
      )}
    </div>
  );
}

function ComboboxTape({
  id,
  products,
  value,
  query,
  placeholder,
  onQueryChange,
  onValueChange,
  onRequestProduct,
}: {
  id: string;
  products: MenuProduct[];
  value: MenuProduct | null;
  query: string;
  placeholder: string;
  onQueryChange: (value: string) => void;
  onValueChange: (value: MenuProduct | null) => void;
  onRequestProduct: () => void;
}) {
  return (
    <Combobox
      items={products}
      value={value}
      onValueChange={onValueChange}
      onInputValueChange={onQueryChange}
      itemToStringLabel={(product: MenuProduct) => product.name}
      isItemEqualToValue={(product: MenuProduct, current: MenuProduct) =>
        product.id === current.id
      }
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        className="h-11 w-full rounded-none bg-white"
      />
      <ComboboxContent className="rounded-none">
        <ComboboxEmpty className="flex-col items-stretch gap-3 p-3 text-left">
          <span className="flex items-start gap-2">
            <PackageSearch
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            <span>
              Nenhum produto cadastrado com esse nome.
            </span>
          </span>
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-none"
            disabled={!query.trim()}
            onClick={onRequestProduct}
          >
            <Send aria-hidden="true" /> Solicitar cadastro
          </Button>
        </ComboboxEmpty>
        <ComboboxList>
          {(product: MenuProduct) => (
            <ComboboxItem
              key={product.id}
              value={product}
              className="min-h-11 cursor-pointer rounded-none px-3 py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{product.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {product.category} · {product.unit}
                </span>
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
