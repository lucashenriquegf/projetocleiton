import Link from 'next/link';

import { SystemState } from '@/components/system/system-state';

export default function PermissionPage() { return <main className="grid min-h-screen place-items-center bg-background p-4"><div><SystemState kind="permission" title="Acesso não permitido" description="Seu perfil não possui permissão para esta área. Volte ao acesso correto para continuar." /><Link href="/" className="mx-auto mt-4 flex min-h-11 w-fit items-center font-medium text-primary">Trocar acesso</Link></div></main>; }
