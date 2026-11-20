'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Info,
  MapPin,
  RouteOff,
  Save,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { ManagerShell } from '@/components/layout/manager-shell';
import { PageFrame } from '@/components/layout/page-frame';
import { SettingsMap } from '@/components/settings/settings-map';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  normalizeRegistrySearch,
  registryItems,
  type RegistryCategory,
  type RegistryItem,
} from '@/lib/mocks/registries';
import {
  formatBrazilianPhone,
  formatBrazilianPostalCode,
} from '@/lib/input-masks';
import { cn } from '@/lib/utils';

export type RegistrationKind = 'product' | 'location' | 'driver' | 'road';

const copy: Record<
  RegistrationKind,
  { eyebrow: string; title: string; description: string; success: string }
> = {
  product: {
    eyebrow: 'Produtos',
    title: 'Cadastrar produto',
    description:
      'Defina como o produto será identificado e medido nas demandas, ofertas e coletas.',
    success: 'Produto salvo e disponível para novas demandas.',
  },
  location: {
    eyebrow: 'Locais e produtores',
    title: 'Cadastrar local',
    description:
      'Registre uma fazenda, destino, estoque ou base como um ponto independente da operação.',
    success: 'Local salvo e disponível para planejamento de rotas.',
  },
  driver: {
    eyebrow: 'Caminhoneiros',
    title: 'Cadastrar caminhoneiro',
    description:
      'Cadastre somente os dados necessários para o gestor atribuir uma rota manualmente.',
    success: 'Caminhoneiro salvo e disponível para atribuição de rotas.',
  },
  road: {
    eyebrow: 'Vias bloqueadas',
    title: 'Cadastrar via bloqueada',
    description:
      'Marque um trecho que nunca deve entrar no cálculo enquanto o bloqueio estiver ativo.',
    success: 'Via bloqueada salva e removida das próximas propostas de rota.',
  },
};

export function RegistrationScreen({ kind }: { kind: RegistrationKind }) {
  const [saved, setSaved] = useState(false);
  const [duplicate, setDuplicate] = useState<RegistryItem | null>(null);
  const searchParams = useSearchParams();
  const pageCopy = copy[kind];
  const requestedReturnTo = searchParams.get('returnTo');
  const defaultBackHref: Record<RegistrationKind, string> = {
    product: '/cadastros/produtos',
    location: '/cadastros/locais',
    driver: '/cadastros/caminhoneiros',
    road: '/cadastros/vias-bloqueadas',
  };
  const backHref =
    requestedReturnTo?.startsWith('/') && !requestedReturnTo.startsWith('//')
      ? requestedReturnTo
      : defaultBackHref[kind];

  function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (duplicate) return;
    setSaved(true);
  }

  function handleChange(event: React.ChangeEvent<HTMLFormElement>) {
    if (saved) setSaved(false);
    const target = event.nativeEvent.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.name !== 'name') return;

    const categoryByKind: Record<RegistrationKind, RegistryCategory> = {
      product: 'produtos',
      location: 'locais',
      driver: 'caminhoneiros',
      road: 'vias-bloqueadas',
    };
    const normalizedName = normalizeRegistrySearch(target.value);
    setDuplicate(
      normalizedName
        ? (registryItems[categoryByKind[kind]].find(
            (item) => normalizeRegistrySearch(item.name) === normalizedName,
          ) ?? null)
        : null,
    );
  }

  return (
    <ManagerShell>
      <PageFrame
        eyebrow={pageCopy.eyebrow}
        title={pageCopy.title}
        description={pageCopy.description}
        backHref={backHref}
      >
        <form
          className="max-w-5xl border bg-white"
          onSubmit={handleSubmit}
          onChange={handleChange}
        >
          {saved ? (
            <output className="flex items-start gap-3 border-b border-success/25 bg-success-soft px-5 py-4 text-sm">
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-success"
              />
              <div>
                <p className="font-semibold text-success">Cadastro salvo</p>
                <p className="mt-0.5 text-muted-foreground">
                  {pageCopy.success}
                </p>
                <Link
                  href={backHref}
                  className="mt-2 inline-flex min-h-9 items-center font-semibold text-success underline-offset-4 hover:underline"
                >
                  Voltar para a listagem
                </Link>
              </div>
            </output>
          ) : null}

          {duplicate ? (
            <div className="flex items-start gap-3 border-b border-warning/30 bg-[#fff8df] px-5 py-4 text-sm">
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-[#765d12]"
              />
              <div>
                <p className="font-semibold">Este cadastro já existe</p>
                <p className="mt-0.5 text-muted-foreground">
                  Encontramos “{duplicate.name}”. Abra o cadastro existente para
                  evitar informações repetidas.
                </p>
                <Link
                  href={`/cadastros/${duplicate.category}/${duplicate.id}`}
                  className="mt-2 inline-flex min-h-9 items-center font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Ver cadastro existente
                </Link>
              </div>
            </div>
          ) : null}

          <div className="p-5 sm:p-7">
            {kind === 'product' ? <ProductFields /> : null}
            {kind === 'location' ? <LocationFields /> : null}
            {kind === 'driver' ? <DriverFields /> : null}
            {kind === 'road' ? <RoadFields /> : null}
          </div>

          <footer className="flex flex-col-reverse gap-3 border-t bg-subtle px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
            <Link
              href={backHref}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'lg' }),
                'h-11 rounded-none px-5',
              )}
            >
              Cancelar
            </Link>
            <Button
              type="submit"
              size="lg"
              disabled={Boolean(duplicate)}
              className="h-11 rounded-none bg-[#245f0a] px-5"
            >
              <Save aria-hidden="true" /> Salvar cadastro
            </Button>
          </footer>
        </form>
      </PageFrame>
    </ManagerShell>
  );
}

function ProductFields() {
  return (
    <div className="space-y-7">
      <SectionHeading
        title="Identificação"
        description="Use um nome simples, igual ao usado por produtores e escolas."
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="product-name" label="Nome do produto" required>
          <Input
            id="product-name"
            name="name"
            placeholder="Ex.: Cenoura"
            required
            className="h-11 rounded-none"
          />
        </FormField>
        <FormField id="product-code" label="Código interno" hint="Opcional">
          <Input
            id="product-code"
            name="code"
            placeholder="Ex.: HOR-012"
            className="h-11 rounded-none"
          />
        </FormField>
        <FormField id="product-unit" label="Unidade de medida" required>
          <select
            id="product-unit"
            name="unit"
            required
            defaultValue=""
            className={selectClassName}
          >
            <option value="" disabled>
              Selecione uma unidade
            </option>
            <option>Quilograma</option>
            <option>Unidade</option>
            <option>Litro</option>
            <option>Dúzia</option>
            <option>Caixa</option>
          </select>
        </FormField>
        <FormField id="product-category" label="Categoria" required>
          <select
            id="product-category"
            name="category"
            required
            defaultValue=""
            className={selectClassName}
          >
            <option value="" disabled>
              Selecione uma categoria
            </option>
            <option>Hortaliças</option>
            <option>Frutas</option>
            <option>Tubérculos</option>
            <option>Grãos</option>
            <option>Proteínas</option>
            <option>Laticínios</option>
          </select>
        </FormField>
        <FormField
          id="product-package"
          label="Tipo de embalagem"
          hint="Opcional"
        >
          <Input
            id="product-package"
            name="package"
            placeholder="Ex.: Caixa plástica retornável"
            className="h-11 rounded-none"
          />
        </FormField>
      </div>
      <ToggleRow
        id="product-perishable"
        label="Produto perecível"
        description="Ajuda o gestor a reconhecer itens que pedem mais agilidade."
      />
      <ToggleRow
        id="product-active"
        label="Produto ativo"
        description="Produtos inativos não aparecem em novas demandas."
        defaultChecked
      />
    </div>
  );
}

function LocationFields() {
  return (
    <div className="space-y-8">
      <div>
        <SectionHeading
          title="Tipo e contato"
          description="Cada fazenda deve ser cadastrada isoladamente, mesmo que pertença à mesma pessoa."
        />
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <FormField id="location-type" label="Tipo de local" required>
            <select
              id="location-type"
              name="type"
              required
              defaultValue=""
              className={selectClassName}
            >
              <option value="" disabled>
                Selecione o tipo
              </option>
              <option>Produtor / fazenda</option>
              <option>Escola / destino</option>
              <option>Estoque</option>
              <option>Base operacional</option>
            </select>
          </FormField>
          <FormField id="location-name" label="Nome do local" required>
            <Input
              id="location-name"
              name="name"
              placeholder="Ex.: Sítio Recanto Verde"
              required
              className="h-11 rounded-none"
            />
          </FormField>
          <FormField id="location-contact" label="Pessoa de contato">
            <Input
              id="location-contact"
              name="contact"
              placeholder="Nome do responsável"
              className="h-11 rounded-none"
            />
          </FormField>
          <FormField id="location-phone" label="Telefone">
            <Input
              id="location-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={20}
              onChange={(event) => {
                event.currentTarget.value = formatBrazilianPhone(event.currentTarget.value);
              }}
              placeholder="(62) 99999-9999"
              className="h-11 rounded-none"
            />
          </FormField>
        </div>
      </div>

      <div className="border-t pt-7">
        <SectionHeading
          title="Endereço"
          description="Inclua uma referência detalhada quando o endereço não for suficiente para encontrar o local."
        />
        <div className="mt-5 grid gap-5 sm:grid-cols-6">
          <FormField id="location-cep" label="CEP" className="sm:col-span-2">
            <Input
              id="location-cep"
              name="postalCode"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={9}
              onChange={(event) => {
                event.currentTarget.value = formatBrazilianPostalCode(event.currentTarget.value);
              }}
              placeholder="00000-000"
              className="h-11 rounded-none"
            />
          </FormField>
          <FormField
            id="location-address"
            label="Via ou estrada"
            required
            className="sm:col-span-4"
          >
            <Input
              id="location-address"
              name="address"
              placeholder="Ex.: GO-070, acesso 14"
              required
              className="h-11 rounded-none"
            />
          </FormField>
          <FormField
            id="location-number"
            label="Número / km"
            className="sm:col-span-2"
          >
            <Input
              id="location-number"
              name="number"
              placeholder="Ex.: km 12"
              className="h-11 rounded-none"
            />
          </FormField>
          <FormField
            id="location-city"
            label="Município"
            required
            className="sm:col-span-4"
          >
            <Input
              id="location-city"
              name="city"
              defaultValue="Inhumas"
              required
              className="h-11 rounded-none"
            />
          </FormField>
          <FormField
            id="location-reference"
            label="Ponto de referência"
            className="sm:col-span-6"
          >
            <Textarea
              id="location-reference"
              name="reference"
              rows={4}
              placeholder="Ex.: depois da ponte, vire à esquerda na porteira verde"
              className="min-h-28 resize-y rounded-none"
            />
          </FormField>
        </div>
      </div>

      <LocationPicker />
    </div>
  );
}

function DriverFields() {
  return (
    <div className="space-y-7">
      <div className="flex gap-3 border bg-subtle p-4 text-sm">
        <Info
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-primary"
        />
        <p>
          O gestor escolhe o caminhoneiro manualmente. Não há veículo,
          capacidade ou frota associados neste MVP.
        </p>
      </div>
      <SectionHeading
        title="Dados do caminhoneiro"
        description="Somente informações úteis para contato e atribuição da rota."
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="driver-name" label="Nome completo" required>
          <Input
            id="driver-name"
            name="name"
            autoComplete="name"
            required
            className="h-11 rounded-none"
          />
        </FormField>
        <FormField id="driver-phone" label="Telefone" required>
          <Input
            id="driver-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            onChange={(event) => {
              event.currentTarget.value = formatBrazilianPhone(event.currentTarget.value);
            }}
            placeholder="(62) 99999-9999"
            required
            className="h-11 rounded-none"
          />
        </FormField>
        <FormField id="driver-base" label="Base de referência" required>
          <select
            id="driver-base"
            name="base"
            required
            defaultValue=""
            className={selectClassName}
          >
            <option value="" disabled>
              Selecione uma base
            </option>
            <option>Cooperativa</option>
            <option>Região Norte</option>
            <option>Região Sul</option>
          </select>
        </FormField>
        <FormField
          id="driver-availability"
          label="Disponibilidade inicial"
          required
        >
          <select
            id="driver-availability"
            name="availability"
            defaultValue="available"
            className={selectClassName}
          >
            <option value="available">Disponível</option>
            <option value="route">Em rota</option>
            <option value="unavailable">Indisponível</option>
          </select>
        </FormField>
      </div>
      <ToggleRow
        id="driver-active"
        label="Caminhoneiro ativo"
        description="Perfis inativos não aparecem ao atribuir uma rota."
        defaultChecked
      />
    </div>
  );
}

function RoadFields() {
  return (
    <div className="space-y-8">
      <div>
        <SectionHeading
          title="Identificação do bloqueio"
          description="Não associe clima ou época do ano: o trecho ativo será sempre evitado."
        />
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <FormField
            id="road-name"
            label="Nome da via ou trecho"
            required
            className="sm:col-span-2"
          >
            <Input
              id="road-name"
              name="name"
              placeholder="Ex.: Ponte do Córrego Fundo"
              required
              className="h-11 rounded-none"
            />
          </FormField>
          <FormField id="road-reference" label="Referência de acesso" required>
            <Input
              id="road-reference"
              name="reference"
              placeholder="Ex.: Estrada do Barreiro, km 6"
              required
              className="h-11 rounded-none"
            />
          </FormField>
          <FormField
            id="road-note"
            label="Observação curta"
            className="sm:col-span-2"
          >
            <Textarea
              id="road-note"
              name="note"
              placeholder="Ex.: Risco permanente de atolamento"
              maxLength={160}
              className="min-h-24 rounded-none"
            />
          </FormField>
        </div>
      </div>
      <RoadPicker />
      <ToggleRow
        id="road-active"
        label="Bloqueio ativo"
        description="Rotas novas não poderão usar o trecho marcado."
        defaultChecked
      />
    </div>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function FormField({
  id,
  label,
  hint,
  required,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <div className="flex min-h-10 items-end justify-between gap-3">
        <Label htmlFor={id} className="leading-5">
          {label}
          {required ? <span className="text-alert"> *</span> : null}
        </Label>
        {hint ? (
          <span className="text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ToggleRow({
  id,
  label,
  description,
  defaultChecked = false,
}: {
  id: string;
  label: string;
  description: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 border bg-subtle p-4">
      <div className="min-w-0 flex-1">
        <Label htmlFor={id} className="font-medium">
          {label}
        </Label>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        name={id}
        defaultChecked={defaultChecked}
        aria-label={label}
      />
    </div>
  );
}

function LocationPicker() {
  const [point, setPoint] = useState({ lat: -16.35742, lng: -49.49681 });

  return (
    <section className="border-t pt-7">
      <SectionHeading
        title="Ponto no mapa"
        description="Arraste o ponto verde até a entrada correta do local."
      />
      <div className="mt-5 grid overflow-hidden border lg:grid-cols-[minmax(0,1.5fr)_280px]">
        <SettingsMap mode="point" onPointChange={setPoint} />
        <div className="bg-subtle p-5">
          <p className="text-sm font-semibold">Ponto marcado</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Próximo à GO-070, na região rural de Inhumas.
          </p>
          <dl className="mt-5 space-y-3 border-y py-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Latitude</dt>
              <dd className="font-medium tabular-nums">
                {point.lat.toFixed(5)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Longitude</dt>
              <dd className="font-medium tabular-nums">
                {point.lng.toFixed(5)}
              </dd>
            </div>
          </dl>
          <p className="mt-5 flex items-start gap-2 text-sm leading-5 text-muted-foreground">
            <MapPin
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-primary"
            />
            As coordenadas mudam quando o ponto é arrastado.
          </p>
        </div>
      </div>
    </section>
  );
}

function RoadPicker() {
  return (
    <section className="border-t pt-7">
      <SectionHeading
        title="Trecho no mapa"
        description="O segmento em vermelho será excluído de todas as propostas enquanto estiver ativo."
      />
      <div className="mt-5 grid overflow-hidden border lg:grid-cols-[minmax(0,1.5fr)_280px]">
        <SettingsMap mode="road" />
        <div className="bg-alert-soft/50 p-5">
          <RouteOff aria-hidden="true" className="size-6 text-alert" />
          <p className="mt-4 text-sm font-semibold">Trecho selecionado</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            620 metros entre a ponte e o acesso da Estrada do Barreiro.
          </p>
          <p className="mt-5 text-sm leading-5 text-muted-foreground">
            A linha vermelha acompanha a via que ficará fora do cálculo.
          </p>
        </div>
      </div>
    </section>
  );
}

const selectClassName =
  'h-11 w-full border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35';
