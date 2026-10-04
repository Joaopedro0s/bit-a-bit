import fs from 'fs';
import path from 'path';

// Emular a API do GitHub e DORA metrics
console.log("Calculando métricas DORA...");
const doraMetrics = {
    deploymentFrequency: "Diário",
    leadTimeForChanges: "2 dias",
    changeFailureRate: "0%",
    timeToRestoreService: "N/A"
};

const doraPath = path.resolve('pages', 'status', 'dora.json');
fs.writeFileSync(doraPath, JSON.stringify(doraMetrics, null, 2));
console.log("Métricas DORA salvas em " + doraPath);
