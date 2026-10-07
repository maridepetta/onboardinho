import { redirect } from "next/navigation";

// /inicio decide: sem sessão → /entrar; primeiro acesso pendente → /primeiro-acesso.
export default function Home() {
  redirect("/inicio");
}
