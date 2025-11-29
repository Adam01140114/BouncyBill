// Firebase Authentication Manager
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.auth = null;
        this.db = null;
        this.initialized = false;
        
        // Wait for Firebase to initialize
        this.waitForFirebase();
    }

    async waitForFirebase() {
        // Poll until Firebase is available
        const checkFirebase = () => {
            if (window.firebaseAuth && window.firebaseDb) {
                this.auth = window.firebaseAuth;
                this.db = window.firebaseDb;
                this.initialized = true;
                
                // Listen for auth state changes
                this.auth.onAuthStateChanged((user) => {
                    this.currentUser = user;
                    if (user) {
                        console.log('User signed in:', user.email);
                        this.onSignedIn();
                    } else {
                        console.log('User signed out');
                        this.onSignedOut();
                    }
                });
            } else {
                // Check again in 100ms
                setTimeout(checkFirebase, 100);
            }
        };
        checkFirebase();
    }

    async waitForInitialization() {
        // Wait up to 5 seconds for Firebase to initialize
        const maxWait = 5000;
        const startTime = Date.now();
        while (!this.initialized && (Date.now() - startTime) < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!this.initialized) {
            throw new Error('Firebase initialization timeout. Please refresh the page.');
        }
    }

    async signUp(email, password) {
        await this.waitForInitialization();
        if (!this.auth) {
            throw new Error('Firebase auth not initialized');
        }
        const { createUserWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        try {
            const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
            return userCredential.user;
        } catch (error) {
            throw error;
        }
    }

    async signIn(email, password) {
        await this.waitForInitialization();
        if (!this.auth) {
            throw new Error('Firebase auth not initialized');
        }
        const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        try {
            const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
            return userCredential.user;
        } catch (error) {
            throw error;
        }
    }

    async signOut() {
        await this.waitForInitialization();
        if (!this.auth) {
            throw new Error('Firebase auth not initialized');
        }
        const { signOut } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        await signOut(this.auth);
    }

    isSignedIn() {
        return this.currentUser !== null;
    }

    getUserId() {
        return this.currentUser ? this.currentUser.uid : null;
    }

    onSignedIn() {
        // Override in app.js
    }

    onSignedOut() {
        // Override in app.js
    }
}

const authManager = new AuthManager();

