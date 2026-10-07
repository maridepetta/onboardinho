import Link from "next/link";
import { ROLE_LABEL, type User } from "@/lib/domain";
import { canDecide, canManageUsers, canReviewRequests } from "@/lib/permissions";
import { listRequests } from "@/lib/store";
import { signOut } from "@/app/actions";
import styles from "./app.module.css";

type Section = "inicio" | "meu-acesso" | "pedidos" | "usuarios";

export async function AppShell({
  user,
  current,
  children,
}: {
  user: User;
  current: Section;
  children: React.ReactNode;
}) {
  const toDecide = canReviewRequests(user)
    ? (await listRequests()).filter((r) => canDecide(user, r)).length
    : 0;

  const links: { id: Section; href: string; label: string; show: boolean }[] = [
    { id: "inicio", href: "/inicio", label: "Início", show: true },
    { id: "meu-acesso", href: "/meu-acesso", label: "Meu acesso", show: true },
    {
      id: "pedidos",
      href: "/pedidos",
      label: toDecide ? `Pedidos (${toDecide})` : "Pedidos",
      show: canReviewRequests(user),
    },
    { id: "usuarios", href: "/admin/usuarios", label: "Usuários", show: canManageUsers(user) },
  ];

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/inicio" className={styles.brand}>
          Assistente de Onboarding
        </Link>
        <nav aria-label="Principal" className={styles.nav}>
          {links
            .filter((l) => l.show)
            .map((l) => (
              <Link
                key={l.id}
                href={l.href}
                aria-current={l.id === current ? "page" : undefined}
                className={l.id === current ? styles.navOn : styles.navLink}
              >
                {l.label}
              </Link>
            ))}
        </nav>
        <form action={signOut} className={styles.who}>
          <span>
            {user.name} · {user.isAdmin ? "Admin" : ROLE_LABEL[user.role]}
          </span>
          <button type="submit" className={styles.linkButton}>
            Sair
          </button>
        </form>
      </header>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
