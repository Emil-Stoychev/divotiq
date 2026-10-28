set shell := ["bash", "-cu"]

default:
    just --list

[parallel]
dev: api web

api:
    cd server && go run .

web:
    cd web && npm run dev

db:
    docker compose --profile docker-db up -d

test:
    cd server && go test ./...
    cd web && npm test

test-api:
    cd server && go run ./cmd/apitest

build:
    cd server && go build -o divotiq-api .
    cd web && npm run build

generate:
    cd server && go generate ./database
