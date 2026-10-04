#!/bin/bash
# Simulação de triagem
echo "Verificando build.zip..."
[ -f build.zip ] && echo "build.zip encontrado" || echo "build.zip não encontrado"
echo "Verificando GDD.pdf..."
[ -f docs/GDD.pdf ] && echo "GDD.pdf encontrado" || echo "GDD.pdf não encontrado"
echo "Gerando manifesto..."
sha256sum build.zip > MANIFESTO.sha256
