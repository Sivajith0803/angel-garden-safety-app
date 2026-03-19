// Get DOM elements
const sosButton = document.getElementById('sosButton');
const messageBox = document.getElementById('messageBox');
const addContactBtn = document.getElementById('addContactBtn');
const contactNameInput = document.getElementById('contactName');
const contactNumberInput = document.getElementById('contactNumber');
const contactList = document.getElementById('contactList');

/**
 * Displays a message in the message box.
 * @param {string} message - The message to display.
 * @param {string} type - The type of message ('info', 'success', 'error').
 */
function showMessage(message, type = 'info') {
    messageBox.textContent = message;
    // Reset classes and add new type and 'show' class for animation
    messageBox.className = `message-box ${type} show`;
    // Hide after 5 seconds
    setTimeout(() => {
        messageBox.classList.remove('show'); // Trigger fade out
        // Optional: clear text after fade out to prevent flicker if re-shown quickly
        setTimeout(() => messageBox.textContent = '', 300);
    }, 5000);
}

/**
 * Retrieves the current geographical location of the user.
 * @returns {Promise<{latitude: number, longitude: number}>} A promise that resolves with latitude and longitude.
 */
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    resolve({ latitude, longitude });
                },
                (error) => {
                    console.error("Geolocation error:", error);
                    let errorMessage = "Unable to retrieve your location.";
                    switch(error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage = "Location access denied. Please enable it in your browser settings.";
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage = "Location information is unavailable.";
                            break;
                        case error.TIMEOUT:
                            errorMessage = "The request to get user location timed out.";
                            break;
                        case error.UNKNOWN_ERROR:
                            errorMessage = "An unknown error occurred while getting location.";
                            break;
                    }
                    reject(new Error(errorMessage));
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // Options for better accuracy
            );
        } else {
            reject(new Error("Geolocation is not supported by your browser."));
        }
    });
}

/**
 * Renders the list of emergency contacts from local storage to the UI.
 */
function renderContacts() {
    contactList.innerHTML = ''; // Clear existing list
    const contacts = JSON.parse(localStorage.getItem('emergencyContacts') || '[]');

    if (contacts.length === 0) {
        contactList.innerHTML = '<p class="text-gray-500 text-sm py-4">No emergency contacts added yet. Add at least one!</p>';
    } else {
        contacts.forEach((contact, index) => {
            const contactItem = document.createElement('div');
            contactItem.className = 'contact-item';
            contactItem.innerHTML = `
                <div class="flex flex-col">
                    <span class="text-gray-800 font-medium">${contact.name}</span>
                    <span class="text-gray-500 text-sm">${contact.value}</span>
                </div>
                <button class="delete-contact-btn" data-index="${index}">
                    <i class="fas fa-trash-alt"></i>
                </button>
            `;
            contactList.appendChild(contactItem);
        });
        // Add event listeners to new delete buttons
        document.querySelectorAll('.delete-contact-btn').forEach(button => {
            button.addEventListener('click', deleteContact);
        });
    }
}

/**
 * Adds a new contact to local storage and re-renders the list.
 */
function addContact() {
    const name = contactNameInput.value.trim();
    const value = contactNumberInput.value.trim(); // Can be phone number or email

    if (name && value) {
        const contacts = JSON.parse(localStorage.getItem('emergencyContacts') || '[]');
        contacts.push({ name, value });
        localStorage.setItem('emergencyContacts', JSON.stringify(contacts));
        renderContacts();
        contactNameInput.value = '';
        contactNumberInput.value = '';
        showMessage('Contact added successfully!', 'success');
    } else {
        showMessage('Please enter both name and phone number/email.', 'error');
    }
}

/**
 * Deletes a contact from local storage based on its index and re-renders the list.
 * @param {Event} event - The click event from the delete button.
 */
function deleteContact(event) {
    const indexToDelete = event.target.closest('.delete-contact-btn').dataset.index;
    let contacts = JSON.parse(localStorage.getItem('emergencyContacts') || '[]');
    contacts.splice(indexToDelete, 1); // Remove the contact at the given index
    localStorage.setItem('emergencyContacts', JSON.stringify(contacts));
    renderContacts();
    showMessage('Contact deleted successfully!', 'success');
}

// SOS Button Click Handler
sosButton.addEventListener('click', async () => {
    showMessage('Getting your location...', 'info');
    sosButton.disabled = true; // Disable button to prevent multiple clicks

    // --- VISUAL FIXES HERE ---
    sosButton.querySelector('.button-text').style.display = 'none'; // Hide the "SOS" text
    sosButton.querySelector('.button-icon').innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; // Show spinner
    // --- END VISUAL FIXES ---

    try {
        const location = await getCurrentLocation();
        const contacts = JSON.parse(localStorage.getItem('emergencyContacts') || '[]');

        if (contacts.length === 0) {
            showMessage('Please add emergency contacts before sending an SOS.', 'error');
            return; // Exit early, finally block will reset button
        }

        const payload = {
            latitude: location.latitude,
            longitude: location.longitude,
            timestamp: new Date().toISOString(),
            emergencyContacts: contacts,
            // In a real app, you'd also include user ID or other identifiers
        };

         showMessage('Sending SOS alert...', 'info');

        // IMPORTANT: Replace '/api/sos' with your actual backend URL if not running on http://127.0.0.1:5000
        // For local testing, if your Flask app runs on http://127.0.0.1:5000,
        // you should use 'http://127.0.0.1:5000/api/sos'
        const response = await fetch('http://127.0.0.1:5000/api/sos', { // Corrected URL for backend communication
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            const result = await response.json();
            showMessage(`SOS sent successfully! Message: ${result.message || 'Alert sent.'}`, 'success');
        } else {
            const errorData = await response.json();
            showMessage(`Failed to send SOS: ${errorData.error || response.statusText}`, 'error');
        }

    } catch (error) {
        console.error("Error sending SOS:", error);
        showMessage(`Error: ${error.message}`, 'error');
    } finally {
        // --- VISUAL RESET HERE ---
        sosButton.disabled = false;
        sosButton.querySelector('.button-text').style.display = 'block'; // Show the "SOS" text again
        sosButton.querySelector('.button-text').textContent = 'SOS'; // Reset text to "SOS"
        sosButton.querySelector('.button-icon').innerHTML = '<i class="fas fa-exclamation-triangle"></i>'; // Reset icon
        // --- END VISUAL RESET ---
    }
});

// Add Contact Button Click Handler
addContactBtn.addEventListener('click', addContact);

// Initial render of contacts when the script loads
document.addEventListener('DOMContentLoaded', renderContacts);
