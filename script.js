// --- 1. AOS Animation Init ---
document.addEventListener('DOMContentLoaded', () => {
    AOS.init({
        duration: 800,
        offset: 100,
        once: true
    });
});

// --- 2. Theme Toggle Logic ---
const themeBtn = document.getElementById('theme-btn');
const icon = themeBtn.querySelector('i');
const html = document.documentElement;

// Check local storage for saved theme
const currentTheme = localStorage.getItem('theme');
if (currentTheme) {
    html.setAttribute('data-theme', currentTheme);
    updateIcon(currentTheme);
}

themeBtn.addEventListener('click', () => {
    const theme = html.getAttribute('data-theme');
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateIcon(newTheme);
});

function updateIcon(theme) {
    if (theme === 'light') {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }
}

// --- 3. Active Link Highlighter on Scroll ---
const sections = document.querySelectorAll('section');
const navLinks = document.querySelectorAll('.nav-link');

window.addEventListener('scroll', () => {
    let current = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        // 200px offset provides a better UX when scrolling
        if (pageYOffset >= (sectionTop - 200)) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').includes(current)) {
            link.classList.add('active');
        }
    });
});

// --- 4. Vanilla Tilt Init for Cards ---
VanillaTilt.init(document.querySelectorAll(".project-card"), {
    max: 5,
    speed: 400,
    glare: true,
    "max-glare": 0.2
});



// --- 5. Mobile Hamburger Menu Logic ---
const hamburgerBtn = document.getElementById('hamburger-btn');
const navLinksContainer = document.getElementById('nav-links');
const navItems = document.querySelectorAll('.nav-link');

// Toggle Menu on Hamburger Click
hamburgerBtn.addEventListener('click', () => {
    navLinksContainer.classList.toggle('mobile-menu-active');
    
    // Icon മാറ്റം (Optional: Bars -> X)
    const icon = hamburgerBtn.querySelector('i');
    if (navLinksContainer.classList.contains('mobile-menu-active')) {
        icon.classList.remove('fa-bars');
        icon.classList.add('fa-times');
    } else {
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
    }
});

// Close Menu when a link is clicked
navItems.forEach(item => {
    item.addEventListener('click', () => {
        if (navLinksContainer.classList.contains('mobile-menu-active')) {
            navLinksContainer.classList.remove('mobile-menu-active');
            
            // Reset Icon
            const icon = hamburgerBtn.querySelector('i');
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        }
    });
});

// Close menu when clicking outside (Optional but good UX)
document.addEventListener('click', (e) => {
    if (!hamburgerBtn.contains(e.target) && !navLinksContainer.contains(e.target)) {
        navLinksContainer.classList.remove('mobile-menu-active');
        const icon = hamburgerBtn.querySelector('i');
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
    }
});

// --- Contact Form Handling with SweetAlert2 ---
const contactForm = document.getElementById('contactForm');

contactForm.addEventListener('submit', function(e) {
    e.preventDefault(); // പേജ് റിഫ്രഷ് ആവുന്നത് തടയുന്നു

    const formData = new FormData(contactForm);
    const object = Object.fromEntries(formData);
    const json = JSON.stringify(object);
    
    // ബട്ടണിലെ ടെക്സ്റ്റ് മാറ്റുന്നു (Sending...)
    const submitBtn = contactForm.querySelector('button');
    const originalText = submitBtn.innerText;
    submitBtn.innerText = "Sending...";

    fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: json
        })
        .then(async (response) => {
            let json = await response.json();
            if (response.status == 200) {
                
                // --- SUCCESS: പഴയ alert() മാറ്റി ഇത് കൊടുത്തു ---
                Swal.fire({
                    title: 'Message Sent!',
                    text: 'Thank you for reaching out. I will get back to you soon.',
                    icon: 'success',
                    confirmButtonText: 'Great!',
                    confirmButtonColor: '#6366f1', // Button Color
                    background: 'rgba(20, 20, 20, 0.9)', // Glass Dark Background
                    color: '#ffffff', // Text Color
                    backdrop: `
                        rgba(99, 102, 241, 0.1)
                        left top
                        no-repeat
                    `
                });
                // ----------------------------------------------

                contactForm.reset(); // ഫോം ക്ലിയർ ചെയ്യുന്നു
            } else {
                console.log(response);
                
                // --- ERROR: പഴയ alert() മാറ്റി ഇത് കൊടുത്തു ---
                Swal.fire({
                    icon: 'error',
                    title: 'Oops...',
                    text: 'Something went wrong! Please try again.',
                    background: 'rgba(20, 20, 20, 0.9)',
                    color: '#ffffff'
                });
                // --------------------------------------------
            }
        })
        .catch(error => {
            console.log(error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Something went wrong!',
                background: 'rgba(20, 20, 20, 0.9)',
                color: '#ffffff'
            });
        })
        .then(function() {
            // ബട്ടൺ ടെക്സ്റ്റ് പഴയത് പോലെ ആക്കുന്നു
            submitBtn.innerText = originalText;
        });
});