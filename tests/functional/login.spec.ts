import { test, expect } from '@playwright/test'
test.describe("Login Functionality", () => {
    test.beforeEach("Go to login page", async ({ page })=>{
        // 1. Luanch URL
        await page.goto('https://katalon-demo-cura.herokuapp.com/');
        // 2. Click on the Make Appointment
        await page.getByRole('link', { name: 'Make Appointment' }).click();
        await expect(page.getByText('Please login to make')).toBeVisible();
    })
    test("Should load home page with correct title", async ({ page }) => {
        
        // Successful  Login
        await page.getByLabel('Username').fill('John Doe');
        await page.getByLabel('Password').fill('ThisIsNotAPassword');
        await page.getByRole("button", { name: 'Login' }).click();
        // Assert a text
        await expect(page.locator('h2')).toContainText('Make Appointment')
    })
    test("Should prevent for incorrect creds", async ({ page }) => {
        // Unsuccessful Login
        await page.getByLabel('Username').fill('John Smith');
        await page.getByLabel('Password').fill('ThisIsNotAPassword');
        await page.getByRole("button", { name: 'Login' }).click();
        await expect(page.locator('#login')).toContainText('Login failed! Please ensure the username and password are valid.');
    })
})
