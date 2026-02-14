# J-Chat 2

![Version](https://img.shields.io/badge/version-2.1.0-black?style=for-the-badge)
![License Apache](https://img.shields.io/badge/license-Apache_2.0-white?style=for-the-badge)
![License MIT](https://img.shields.io/badge/license-MIT-white?style=for-the-badge)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.18606793.svg)](https://doi.org/10.5281/zenodo.18606793)

**J-Chat 2** is a secure, persistent, and aesthetically distinct messaging application designed with a strict **Monochrome Design Philosophy**. It prioritizes user privacy through **End-to-End Encryption (E2EE)** and **Salted Password Hashing**.

---

## 📸 Features

* **Monochrome UI**: A strict black-and-white aesthetic using `DotGothic16` typography.
* **End-to-End Encryption**: Messages are encrypted using derived keys (Password + Partner ID). Even the server administrator cannot read your messages.
* **Instant Sync**: Uses **Long Polling** architecture for real-time, battery-efficient communication.
* **Secure Identity**: Passwords are protected using **Scrypt** with unique per-user salts.
* **Right to be Forgotten**: One-click account deletion permanently wipes data from both client and server.

---

## 🚀 Installation

1.  **Server**
    ```bash
    cd server
    npm install
    node index.js
    ```

2.  **Client**
    ```bash
    # From root
    npm install
    npm run dev
    ```

---

## 🛠️ Technology Stack

* **Frontend**: React (TypeScript), TailwindCSS, Vite
* **Backend**: Node.js, Express, Better-SQLite3
* **Security**: AES-256 (Client), Scrypt (Server)

---

## 👨‍💻 Author

**Jubayer Samse Alif**
*Developer & Researcher*
Email: jubayer.alif2021@gmail.com

---

## 📄 Citation

**BibTeX:**
```bibtex
@software{alif2026jchat2,
  author = {Alif, Jubayer Samse},
  title = {J-Chat 2: A Privacy-Oriented Messaging Application},
  year = {2026},
  publisher = {Zenodo},
  version = {2.1.0},
  doi = {10.5281/zenodo.18606793},
  url = {[https://doi.org/10.5281/zenodo.18606793](https://doi.org/10.5281/zenodo.18606793)}
}
