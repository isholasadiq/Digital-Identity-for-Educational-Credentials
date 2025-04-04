;; Student Verification Contract
;; This contract validates and stores student identity information

;; Define data variables
(define-data-var contract-owner principal tx-sender)
(define-map students
  { student-id: (string-utf8 36) }
  {
    principal: principal,
    verified: bool,
    verification-date: (optional uint),
    verification-authority: (optional principal)
  }
)

;; Error codes
(define-constant ERR_UNAUTHORIZED u1)
(define-constant ERR_ALREADY_REGISTERED u2)
(define-constant ERR_NOT_FOUND u3)

;; Read-only functions
(define-read-only (get-student-info (student-id (string-utf8 36)))
  (map-get? students { student-id: student-id })
)

(define-read-only (is-student-verified (student-id (string-utf8 36)))
  (default-to false (get verified (get-student-info student-id)))
)

;; Public functions
(define-public (register-student (student-id (string-utf8 36)))
  (let ((existing-record (get-student-info student-id)))
    (asserts! (is-none existing-record) (err ERR_ALREADY_REGISTERED))

    (map-set students
      { student-id: student-id }
      {
        principal: tx-sender,
        verified: false,
        verification-date: none,
        verification-authority: none
      }
    )
    (ok true)
  )
)

(define-public (verify-student (student-id (string-utf8 36)))
  (let ((student-record (get-student-info student-id)))
    ;; Only verification authorities can verify students
    (asserts! (is-verification-authority tx-sender) (err ERR_UNAUTHORIZED))
    (asserts! (is-some student-record) (err ERR_NOT_FOUND))

    (map-set students
      { student-id: student-id }
      (merge (unwrap-panic student-record)
        {
          verified: true,
          verification-date: (some block-height),
          verification-authority: (some tx-sender)
        }
      )
    )
    (ok true)
  )
)

;; Private functions
(define-private (is-verification-authority (address principal))
  ;; In a real implementation, this would check against a list of authorized institutions
  ;; For simplicity, we're just checking if it's the contract owner
  (is-eq address (var-get contract-owner))
)

;; Contract initialization
;; Nothing to initialize for this simple example
