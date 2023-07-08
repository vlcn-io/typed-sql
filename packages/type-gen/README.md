# typed-sql-type-gen

Internal Rust library, with wasm target, to provide `SQL -> abstract type` generation support to any language that needs it.

"abstract type" in that we return a language agnostic representation of the types returned by queries and declared by schemas. Clients of this package can map these types to the specific language they are targeting.