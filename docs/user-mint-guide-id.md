# Panduan Mint HER Untuk User Awam

HER tidak di-mint dari tombol website biasa. Website HER hanya terminal untuk connect wallet dan tanda tangan mission. Transaksi mint harus dikirim oleh agent yang punya wallet sendiri.

Hermes Agent direkomendasikan, tapi agent lain juga bisa dipakai kalau agent itu punya wallet dan bisa kirim transaksi di Base.

## Yang User Butuhkan

1. Wallet pribadi seperti MetaMask atau Rabby.
2. Network Base.
3. Agent yang punya wallet/executor sendiri.
4. ETH di wallet agent untuk gas dan fee mint.
5. Mission code dari agent.

## Aturan Mint

1. 1 mint = 1,000 HER.
2. Limit per wallet user = 10 mint.
3. Fee = 0.0006 ETH per mint.
4. Website tidak bisa direct mint.
5. Agent wallet wajib mengirim transaksi mint.
6. Agent wallet harus beda dari wallet user penerima.

## Cara Mint

1. Buka agent kamu. Hermes Agent direkomendasikan.
2. Bilang:

```text
Create a HER mint mission on Base for my wallet.
```

3. Agent memberi:

```text
Agent wallet: 0x...
Mission code: HER-8453-XXXX
```

4. Buka website:

```text
https://her-terminal.xyz
```

5. Connect wallet pribadi.
6. Switch ke Base.
7. Paste agent wallet.
8. Paste mission code.
9. Pilih jumlah mint: 1x, 2x, 5x, atau 10x.
10. Klik `sign permit`.
11. Buka tab `Packet`.
12. Copy packet.
13. Kirim packet itu balik ke agent.
14. Agent wallet menjalankan transaksi `agentMint`.
15. HER masuk ke wallet kamu.
16. Cek transaksi di BaseScan.

## Apa Itu Permit?

Permit adalah tanda tangan izin. Ini bukan transaksi mint dan belum memindahkan token.

Permit hanya bilang:

```text
Wallet user mengizinkan agent wallet ini untuk mint HER pada mission ini,
dengan jumlah mint ini, sebelum deadline habis.
```

## Kalau Agent Tidak Punya Wallet

Agent itu tidak bisa mint HER.

Rule HER:

```text
No agent wallet, no mint.
```

User harus memakai agent yang punya wallet dan bisa kirim transaksi Base.

## Kenapa Bukan Direct Mint?

Karena konsep HER adalah agent mining. Website hanya membuat packet dan permit. Smart contract menerima transaksi dari wallet agent yang tertulis di permit, bukan dari tombol mint website.
