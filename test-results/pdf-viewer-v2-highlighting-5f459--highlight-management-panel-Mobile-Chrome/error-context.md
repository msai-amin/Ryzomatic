# Page snapshot

```yaml
- generic [ref=e4]:
  - generic:
    - generic: ryzomatic
    - img "ryzomatic logo background"
    - img "ryzomatic logo background 2"
  - generic [ref=e5]:
    - img "ryzomatic" [ref=e6]
    - heading "ryzomatic" [level=1] [ref=e7]
  - generic [ref=e9]:
    - generic [ref=e10]:
      - heading "Sign In" [level=2] [ref=e12]
      - button [ref=e13] [cursor=pointer]:
        - img [ref=e14]
    - generic [ref=e17]:
      - generic [ref=e18]:
        - generic [ref=e19]:
          - generic [ref=e20]: Email Address
          - generic [ref=e21]:
            - img [ref=e22]
            - textbox "Enter your email" [ref=e25]
        - generic [ref=e26]:
          - generic [ref=e27]: Password
          - generic [ref=e28]:
            - img [ref=e29]
            - textbox "Enter your password" [ref=e32]
            - button "Show password" [ref=e33] [cursor=pointer]:
              - img [ref=e34]
        - button "Sign In" [ref=e37] [cursor=pointer]
      - generic [ref=e38]:
        - generic [ref=e43]: Or continue with
        - button "Continue with Google" [ref=e44] [cursor=pointer]:
          - img [ref=e45]
          - text: Continue with Google
      - button "Don't have an account? Sign Up" [ref=e51] [cursor=pointer]
```