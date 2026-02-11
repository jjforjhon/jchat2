# J-Chat 2

![Version](https://img.shields.io/badge/version-2.0.0-black?style=for-the-badge)
![License Apache](https://img.shields.io/badge/license-Apache_2.0-white?style=for-the-badge)
![License MIT](https://img.shields.io/badge/license-MIT-white?style=for-the-badge)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.18606793.svg)](https://doi.org/10.5281/zenodo.18606793)

**J-Chat 2** is a secure, persistent, and aesthetically distinct messaging application designed with the **"Black & white"** design philosophy. It prioritizes user privacy through end-to-end encrypted channels while offering a high-fidelity monochrome user interface.

Built using **React (TypeScript)**, **Node.js**, and **SQLite**, J-Chat 2 allows for real-time communication, media sharing, and persistent identity management without relying on traditional centralized data harvesting.

---

## 📸 Features

* **UI OS Aesthetic**: A strict monochrome UI with dot-matrix typography (`DotGothic16`) and industrial design elements.
* **Persistent Identity**: Users can create secure accounts with password-protected persistent sessions.
* **Secure Messaging**: Messages are synced in real-time and stored securely with local encryption.
* **Media Lightbox**: Native support for viewing high-resolution images and videos within a dedicated lightbox.
* **Privacy Controls**: Built-in blocking, chat deletion, and account self-destruction (server-side wipe).
* **Notifications**: Browser-native push notifications for incoming messages.

---

## 🚀 Installation & Usage

### Prerequisites
* Node.js (v18 or higher)
* npm (v9 or higher)

### Setup

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/jjforjhon/jchat2.git](https://github.com/jjforjhon/jchat2.git)
    cd jchat2
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Start the Development Server**
    ```bash
    npm run dev
    ```

4.  **Build for Production**
    ```bash
    npm run build
    ```

---

## 🛠️ Technology Stack

* **Frontend**: React, TypeScript, TailwindCSS, Vite
* **Backend**: Node.js, Express, Better-SQLite3
* **Design**: Custom "Nothing OS" CSS System, Dot Matrix Typography
* **Storage**: LocalStorage (Session), SQLite (Server Persistence)

---

## 👨‍💻 Author

**Jubayer Samse Alif**
*Developer & Researcher*
Email : jubayer.alif2021@gmail.com

---

## 📄 Citation

If you use **J-Chat 2** in your research or academic work, please cite it as follows:

**BibTeX:**
```bibtex
@software{alif2026jchat2,
  author = {Alif, Jubayer Samse}, Email : jubayer.alif2021@gmail.com
  title = {J-Chat 2: A Secure Messaging Application with Nothing OS Aesthetics},
  year = {2026},
  publisher = {Zenodo},
  version = {2.0.0},
  doi = {10.5281/zenodo.18606793},
  url = {[https://doi.org/10.5281/zenodo.18606793](https://doi.org/10.5281/zenodo.18606793)}
}

