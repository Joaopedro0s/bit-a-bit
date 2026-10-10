# Política de Segurança

## Reporte de Vulnerabilidades
Para reportar vulnerabilidades de segurança de forma responsável, entre em contato com a equipe de SRE e Segurança.

## Auditoria de Dependências
- O comando `npm audit` é executado na esteira de CI/CD.
- O pipeline irá **falhar imediatamente** se forem detectadas vulnerabilidades com severidade **Crítica (Critical)**.

## Gestão de PRs do Dependabot
- Pull Requests abertos pelo Dependabot devem ser revisados por um membro da equipe de segurança.
- Atualizações de segurança devem ser testadas em ambiente de staging antes do merge na branch `main`.

## Vazamento de Segredos (Secret Leakage)
Caso um segredo, chave de API ou credencial seja commitado acidentalmente:
1. **Revogação Imediata**: A chave/credencial deve ser revogada e reemitida no serviço de origem imediatamente.
2. **Purga do Histórico**: O commit contendo o segredo deve ser removido do histórico do Git utilizando ferramentas como `git-filter-repo` ou BFG Repo-Cleaner.
3. **Notificação**: Notifique a equipe de SRE para verificar acessos não autorizados durante o período de exposição.