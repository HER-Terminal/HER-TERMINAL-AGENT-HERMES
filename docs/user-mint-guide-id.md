# Panduan Mint HER Untuk User Awam

HER tidak di-mint dari tombol website biasa. HER di-mint lewat Hermes Agent milik user masing-masing.

## Yang User Butuhkan

1. Wallet seperti MetaMask atau Rabby.
2. Network Base.
3. Sedikit ETH di Base untuk gas/mint fee.
4. Hermes Agent pribadi.
5. Mission code dan executor address dari Hermes Agent.

## Aturan Mint

1. 1 mint = 1,000 HER.
2. Limit per wallet = 10 mint.
3. Fee = 0.0006 ETH per mint.
4. Mint hanya bisa diroute oleh Hermes Agent.

## Cara Mint

1. Buka Hermes Agent milik kamu.
2. Bilang:

```text
Mint HER on Base for my wallet.
```

3. Hermes Agent akan mengambil mission dari HER Agent Protocol.
4. Agent memberi dua data:
   - executor address
   - mission code
5. Buka website HER.
6. Connect wallet.
7. Switch ke Base.
8. Paste executor address.
9. Paste mission code.
10. Pilih jumlah mint.
11. Klik `sign permit`.
12. Buka tab `Agent`.
13. Copy packet.
14. Kirim packet itu balik ke Hermes Agent.
15. Hermes Agent menjalankan mint.
16. HER masuk ke wallet kamu.
17. Cek transaksi di BaseScan.

## Apa Itu Permit?

Permit adalah tanda tangan izin. Ini bukan transaksi mint dan belum memindahkan token.

Permit hanya bilang:

```text
Wallet ini mengizinkan executor Hermes Agent ini untuk mint HER pada mission ini, dengan jumlah mint ini, sebelum deadline habis.
```

## Kalau Hermes Agent Tidak Punya Wallet

Masih bisa. Hermes Agent dapat memakai fallback `/relay` dari HER Agent Protocol.

Flow-nya:

1. User tetap sign permit dari wallet pribadi.
2. Hermes Agent mengirim packet ke relay.
3. Relay mengeksekusi transaksi.
4. HER tetap masuk ke wallet user.

## Kenapa Bukan Direct Mint?

Karena konsep HER adalah agent mint. Smart contract hanya menerima transaksi dari executor Hermes Agent yang authorized. Jadi mint terasa beda: bukan sekadar klik tombol, tapi mission yang diroute oleh agent.
