'use client';

import {
  Check,
  CheckCircle2,
  Clock3,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  Warehouse,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { ManagerShell } from '@/components/layout/manager-shell';
import { PageFrame } from '@/components/layout/page-frame';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { stockItems as initialItems } from '@/lib/mocks/operations';

const productCatalog = [
  { id: 'alface', name: 'Alface', unit: 'unidades' },
  { id: 'batata', name: 'Batata', unit: 'kg' },
  { id: 'ovos', name: 'Ovos', unit: 'dúzias' },
  { id: 'farinha', name: 'Farinha', unit: 'kg' },
  { id: 'feijao', name: 'Feijão', unit: 'kg' },
  { id: 'leite', name: 'Leite', unit: 'litros' },
  { id: 'cenoura', name: 'Cenoura', unit: 'kg' },
  { id: 'couve', name: 'Couve', unit: 'maços' },
  { id: 'mandioca', name: 'Mandioca', unit: 'kg' },
  { id: 'banana', name: 'Banana', unit: 'kg' },
];

type StockItem = (typeof initialItems)[number];

export default function StockPage() {
  const [items, setItems] = useState<StockItem[]>(initialItems);
  const [query, setQuery] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(0);
  const [adding, setAdding] = useState(false);
  const [newProductId, setNewProductId] = useState('');
  const [newQuantity, setNewQuantity] = useState(0);
  const [removing, setRemoving] = useState<StockItem | null>(null);
  const [feedback, setFeedback] = useState('');

  const availableProducts = useMemo(
    () =>
      productCatalog.filter(
        (product) => !items.some((item) => item.id === product.id),
      ),
    [items],
  );

  const selectedProduct = availableProducts.find(
    (product) => product.id === newProductId,
  );

  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          item.name.toLowerCase().includes(query.toLowerCase()) &&
          (!onlyAvailable || item.quantity > 0),
      ),
    [items, onlyAvailable, query],
  );

  function openAddDialog() {
    setNewProductId(availableProducts[0]?.id ?? '');
    setNewQuantity(0);
    setAdding(true);
  }

  function addProduct() {
    const product = availableProducts.find((item) => item.id === newProductId);
    if (!product) return;

    setItems((current) => [
      ...current,
      { ...product, quantity: Math.max(0, newQuantity), updated: 'Agora' },
    ]);
    setAdding(false);
    setFeedback(`${product.name} foi adicionado ao estoque.`);
  }

  function saveQuantity() {
    if (!editing) return;

    const item = items.find((current) => current.id === editing);
    setItems((current) =>
      current.map((currentItem) =>
        currentItem.id === editing
          ? {
              ...currentItem,
              quantity: Math.max(0, quantity),
              updated: 'Agora',
            }
          : currentItem,
      ),
    );
    setEditing(null);
    if (item) setFeedback(`Quantidade de ${item.name} atualizada.`);
  }

  function removeProduct() {
    if (!removing) return;

    setItems((current) => current.filter((item) => item.id !== removing.id));
    if (editing === removing.id) setEditing(null);
    setFeedback(
      `${removing.name} foi removido do estoque, mas continua disponível no catálogo.`,
    );
    setRemoving(null);
  }

  return (
    <ManagerShell>
      <PageFrame
        eyebrow="Consulta rápida"
        title="Estoque"
        description="Somente o saldo atual. O planejamento sempre prioriza o que já está guardado."
        action={
          <Button
            type="button"
            size="lg"
            onClick={openAddDialog}
            disabled={availableProducts.length === 0}
            className="h-11 rounded-none bg-[#245f0a] px-4 font-semibold"
          >
            <Plus aria-hidden="true" /> Adicionar produto
          </Button>
        }
      >
        {feedback ? (
          <output className="mb-5 flex w-full items-start gap-3 border border-success/25 bg-success-soft px-4 py-3 text-sm">
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-success"
            />
            <p className="flex-1">{feedback}</p>
            <button
              type="button"
              onClick={() => setFeedback('')}
              className="min-h-8 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Fechar
            </button>
          </output>
        ) : null}

        <div className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-md">
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar produto"
              aria-label="Buscar produto no estoque"
              className="h-11 rounded-none bg-white pl-10"
            />
          </div>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(event) => setOnlyAvailable(event.target.checked)}
              className="size-4 accent-primary"
            />
            Somente com saldo
          </label>
        </div>

        <section
          aria-labelledby="stock-list-title"
          className="mt-5 border bg-white"
        >
          <header className="flex items-center gap-3 border-b px-5 py-4">
            <Warehouse aria-hidden="true" className="size-5 text-primary" />
            <div className="min-w-0 flex-1">
              <h2 id="stock-list-title" className="font-semibold">
                Estoque da cooperativa
              </h2>
              <p className="text-xs text-muted-foreground">
                Rod. GO-070, km 12 · {items.length} produtos cadastrados
              </p>
            </div>
          </header>

          {visible.length > 0 ? (
            <ul className="divide-y">
              {visible.map((item) => (
                <li key={item.id} className="px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="grid size-10 place-items-center bg-primary-soft text-primary">
                      <Package aria-hidden="true" className="size-5" />
                    </span>
                    <div className="min-w-[150px] flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock3 aria-hidden="true" className="size-3" />{' '}
                        {item.updated}
                      </p>
                    </div>
                    <p
                      className={`min-w-32 text-right text-xl font-semibold tabular-nums ${item.quantity === 0 ? 'text-alert' : ''}`}
                    >
                      {item.quantity}{' '}
                      <span className="text-sm font-normal text-muted-foreground">
                        {item.unit}
                      </span>
                    </p>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-11 rounded-none"
                        onClick={() => {
                          setEditing(item.id);
                          setQuantity(item.quantity);
                          setFeedback('');
                        }}
                      >
                        <Pencil aria-hidden="true" /> Atualizar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label={`Remover ${item.name} do estoque`}
                        title={`Remover ${item.name}`}
                        className="h-11 rounded-none px-3 text-alert hover:bg-alert-soft hover:text-alert"
                        onClick={() => setRemoving(item)}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  {editing === item.id ? (
                    <div className="mt-4 flex flex-col gap-3 border-t bg-subtle px-4 py-4 sm:flex-row sm:items-end">
                      <div className="flex-1">
                        <Label htmlFor={`quantity-${item.id}`}>
                          Nova quantidade em {item.unit}
                        </Label>
                        <Input
                          id={`quantity-${item.id}`}
                          type="number"
                          min="0"
                          value={quantity}
                          onChange={(event) =>
                            setQuantity(Number(event.target.value))
                          }
                          className="mt-2 h-11 max-w-xs rounded-none bg-white"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-11 rounded-none"
                          onClick={() => setEditing(null)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          className="h-11 rounded-none bg-[#245f0a]"
                          onClick={saveQuantity}
                        >
                          <Check aria-hidden="true" /> Salvar quantidade
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <Empty className="min-h-56 rounded-none border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Package aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>Nenhum produto encontrado</EmptyTitle>
                <EmptyDescription>
                  Limpe a busca ou adicione um produto do catálogo ao estoque.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>

        <Dialog open={adding} onOpenChange={setAdding}>
          <DialogContent
            showCloseButton={false}
            className="max-w-lg rounded-none p-5 sm:max-w-lg"
          >
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                Adicionar produto ao estoque
              </DialogTitle>
              <DialogDescription>
                Escolha um produto já cadastrado e informe quanto existe agora.
              </DialogDescription>
            </DialogHeader>

            {availableProducts.length > 0 ? (
              <div className="grid gap-5 py-2 sm:grid-cols-[minmax(0,1fr)_150px] sm:items-start">
                <div className="flex min-w-0 flex-col">
                  <Label
                    htmlFor="new-stock-product"
                    className="flex min-h-10 items-end leading-5"
                  >
                    Produto
                  </Label>
                  <select
                    id="new-stock-product"
                    value={newProductId}
                    onChange={(event) => setNewProductId(event.target.value)}
                    className="mt-2 h-11 w-full border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35"
                  >
                    {availableProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex min-w-0 flex-col">
                  <Label
                    htmlFor="new-stock-quantity"
                    className="flex min-h-10 items-end leading-5"
                  >
                    Quantidade inicial
                  </Label>
                  <Input
                    id="new-stock-quantity"
                    type="number"
                    min="0"
                    value={newQuantity}
                    onChange={(event) =>
                      setNewQuantity(Number(event.target.value))
                    }
                    className="mt-2 h-11 rounded-none"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedProduct?.unit}
                  </p>
                </div>
              </div>
            ) : (
              <p className="border bg-subtle p-4 text-sm">
                Todos os produtos do catálogo já estão presentes no estoque.
              </p>
            )}

            <DialogFooter className="rounded-none">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-none"
                onClick={() => setAdding(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={!selectedProduct}
                className="h-11 rounded-none bg-[#245f0a]"
                onClick={addProduct}
              >
                <Plus aria-hidden="true" /> Adicionar ao estoque
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={Boolean(removing)}
          onOpenChange={(open) => !open && setRemoving(null)}
        >
          <AlertDialogContent className="rounded-none">
            <AlertDialogHeader>
              <AlertDialogMedia className="rounded-none bg-alert-soft text-alert">
                <TriangleAlert aria-hidden="true" />
              </AlertDialogMedia>
              <AlertDialogTitle>
                Remover {removing?.name} do estoque?
              </AlertDialogTitle>
              <AlertDialogDescription>
                O saldo atual deixará de aparecer no planejamento. O produto
                continuará cadastrado no catálogo e poderá ser adicionado
                novamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="rounded-none">
              <AlertDialogCancel className="h-11 rounded-none">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                type="button"
                variant="destructive"
                className="h-11 rounded-none"
                onClick={removeProduct}
              >
                <Trash2 aria-hidden="true" /> Remover do estoque
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageFrame>
    </ManagerShell>
  );
}
